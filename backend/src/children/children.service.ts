import { Injectable, Logger, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Child } from './schemas/child.schema';
import { DeviceSession } from './schemas/device-session.schema';
import { GuestLink } from './schemas/guest-link.schema';
import { Parent } from '../auth/schemas/parent.schema';
import { MatchService } from '../match/match.service';
import { HomeworkService } from '../homework/homework.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationAiService } from './notification-ai.service';

const GUEST_LINK_TTL_MS = 60 * 1000; // 1 minute invitation code lifetime

@Injectable()
export class ChildrenService {
  private readonly logger = new Logger(ChildrenService.name);

  constructor(
    @InjectModel(Child.name) private childModel: Model<Child>,
    @InjectModel(DeviceSession.name)
    private sessionModel: Model<DeviceSession>,
    @InjectModel(GuestLink.name)
    private guestLinkModel: Model<GuestLink>,
    @InjectModel(Parent.name)
    private parentModel: Model<Parent>,
    @Inject(forwardRef(() => MatchService))
    private matchService: MatchService,
    @Inject(forwardRef(() => HomeworkService))
    private homeworkService: HomeworkService,
    private realtimeGateway: RealtimeGateway,
    private notificationAiService: NotificationAiService,
  ) {}

  async createChild(
    parentId: string,
    data: { displayName: string; grade: string; avatarUrl?: string },
  ): Promise<Child> {
    const child = await this.childModel.create({
      ...data,
      parentId: new Types.ObjectId(parentId),
    });
    this.logger.log(`Child created: ${child.displayName}`);
    return child;
  }

  async getChildrenByParent(parentId: string): Promise<Child[]> {
    return this.childModel.find({ parentId: new Types.ObjectId(parentId) });
  }

  async getChildById(id: string): Promise<Child | null> {
    return this.childModel.findById(id);
  }

  async deleteChild(parentId: string, childId: string): Promise<Child | null> {
    const oid = new Types.ObjectId(childId);
    const poid = new Types.ObjectId(parentId);

    const child = await this.childModel.findOneAndDelete({
      _id: oid,
      parentId: poid,
    });

    if (child) {
      this.logger.log(`Child deleted: ${child.displayName}. Starting data erasure...`);

      // 1. Erase matches and answers
      await this.matchService.deleteAllByChild(childId);

      // 2. Erase homework and chats
      await this.homeworkService.deleteAllByChild(childId);

      // 3. Delete guest links
      await this.guestLinkModel.deleteMany({ childId: oid });

      // 4. Handle active sessions/logout
      const activeSessions = await this.sessionModel.find({
        childId: oid,
        isActive: true,
      });

      for (const session of activeSessions) {
        // Emit real-time "logout" event to the kid's device
        this.realtimeGateway.emitChildDeleted(session.sessionToken, childId);

        // Deactivate the session
        session.isActive = false;
        await session.save();
      }

      // Also notify devices linked via short guest-link codes watching the child room
      this.realtimeGateway.emitChildDeletedToChild(childId);

      this.logger.log(`Child ${childId} cleanup complete.`);
    }

    return child;
  }

  async createQRSession(parentId: string): Promise<DeviceSession> {
    const sessionToken = uuidv4().slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const session = await this.sessionModel.create({
      parentId: new Types.ObjectId(parentId),
      sessionToken,
      qrData: JSON.stringify({ token: sessionToken, parentId }),
      expiresAt,
    });

    this.logger.log(`QR session created: ${sessionToken}`);
    return session;
  }

  async linkChildToSession(
    sessionToken: string,
    childId: string,
  ): Promise<DeviceSession | null> {
    const session = await this.sessionModel.findOneAndUpdate(
      { sessionToken, isActive: true, expiresAt: { $gt: new Date() } },
      { childId: new Types.ObjectId(childId) },
      { new: true },
    );
    if (session) {
      this.logger.log(`Child ${childId} linked to session ${sessionToken}`);
    }
    return session;
  }

  async validateSession(sessionToken: string): Promise<DeviceSession | null> {
    return this.sessionModel.findOne({
      sessionToken,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });
  }

  async createUnauthenticatedSession(): Promise<DeviceSession> {
    const sessionToken = uuidv4().slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const session = await this.sessionModel.create({
      sessionToken,
      qrData: JSON.stringify({ token: sessionToken }),
      expiresAt,
    });

    this.logger.log(`Unauthenticated session created: ${sessionToken}`);
    return session;
  }

  async markChildLinked(childId: string): Promise<Child | null> {
    if (!Types.ObjectId.isValid(childId)) return null;
    const now = new Date();
    return this.childModel.findByIdAndUpdate(
      childId,
      { $set: { isLinked: true, linkedAt: now, lastActiveAt: now } },
      { new: true },
    );
  }

  /**
   * Revokes all active device links for a child without deleting the child profile,
   * quiz history, or homework sessions. Increments tokenVersion so existing child
   * JWTs are rejected immediately, and broadcasts a real-time unlink signal.
   */
  async unlinkChildDevices(parentId: string, childId: string): Promise<Child> {
    if (!Types.ObjectId.isValid(childId)) {
      throw new NotFoundException('Child not found');
    }
    const childOid = new Types.ObjectId(childId);
    const parentOid = new Types.ObjectId(parentId);

    const child = await this.childModel.findOneAndUpdate(
      { _id: childOid, parentId: parentOid },
      { $inc: { tokenVersion: 1 }, $set: { isLinked: false, linkedAt: null } },
      { new: true },
    );
    if (!child) {
      throw new NotFoundException('Child not found');
    }

    await this.guestLinkModel.deleteMany({ childId: childOid, used: false });

    const activeSessions = await this.sessionModel.find({
      childId: childOid,
      isActive: true,
    });
    const sessionTokens = activeSessions.map((s) => s.sessionToken);

    if (activeSessions.length > 0) {
      await this.sessionModel.updateMany(
        { childId: childOid, isActive: true },
        { $set: { isActive: false } },
      );
    }

    this.realtimeGateway.emitChildUnlinked(childId, sessionTokens);
    this.logger.log(`Child ${childId} devices unlinked by parent ${parentId}`);
    return child;
  }

  async authorizeSession(
    sessionToken: string,
    parentId: string,
    childId?: string,
  ): Promise<DeviceSession | null> {
    const cleanToken = sessionToken.trim().toUpperCase();
    const parentOid = new Types.ObjectId(parentId);
    const updateData: any = { parentId: parentOid };

    if (childId) {
      if (!Types.ObjectId.isValid(childId)) {
        throw new NotFoundException('Child not found');
      }
      const childOid = new Types.ObjectId(childId);
      const owned = await this.childModel.exists({
        _id: childOid,
        parentId: parentOid,
      });
      if (!owned) {
        throw new NotFoundException('Child not found');
      }
      updateData.childId = childOid;
    }

    const session = await this.sessionModel.findOneAndUpdate(
      {
        sessionToken: cleanToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
        parentId: null,
      },
      updateData,
      { new: true },
    );

    if (session && childId) {
      await this.markChildLinked(childId);
    }

    if (session) {
      this.logger.log(
        `Session ${cleanToken} authorized by parent ${parentId}${childId ? ` with child ${childId}` : ''}`,
      );
    }
    return session;
  }

  async getSessionStatus(
    sessionToken: string,
  ): Promise<{ authorized: boolean; parentId?: string; childId?: string }> {
    const session = await this.sessionModel.findOne({
      sessionToken,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return { authorized: false };
    }

    return {
      authorized: !!session.parentId,
      ...(session.parentId && { parentId: session.parentId.toString() }),
      ...(session.childId && { childId: session.childId.toString() }),
    };
  }

  // ─── Guest link codes ───────────────────────────────────────────────────────

  /**
   * Parent generates a 6-character, 1-minute invitation code + QR for either
   * an existing child profile (`childId`) or a new guest joining their Family Hub.
   */
  async generateGuestLinkCode(
    parentId: string,
    childId?: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    const parentOid = new Types.ObjectId(parentId);
    let childOid: Types.ObjectId | null = null;
    let asciiSeed = '';

    if (childId) {
      if (!Types.ObjectId.isValid(childId)) {
        throw new NotFoundException('Child not found');
      }
      childOid = new Types.ObjectId(childId);
      const child = await this.childModel.findOne({
        _id: childOid,
        parentId: parentOid,
      });
      if (!child) {
        throw new NotFoundException('Child not found');
      }
      asciiSeed = child.displayName;

      // Invalidate any prior unused code for this child
      await this.guestLinkModel.deleteMany({
        childId: childOid,
        used: false,
      });
    } else {
      const parent = await this.parentModel.findById(parentOid);
      if (!parent) {
        throw new NotFoundException('Parent not found');
      }
      asciiSeed = parent.displayName;

      // Invalidate any prior unused general Family Hub invite for this parent
      await this.guestLinkModel.deleteMany({
        parentId: parentOid,
        childId: null,
        used: false,
      });
    }

    const asciiLetters = asciiSeed.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const fallbackTag = childId ? 'KID' : 'FAM';
    const prefix = `${asciiLetters}${fallbackTag}`.slice(0, 3);
    const safeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      let suffix = '';
      for (let i = 0; i < 3; i++) {
        suffix += safeChars[randomInt(safeChars.length)];
      }
      const candidate = `${prefix}${suffix}`;
      const existing = await this.guestLinkModel.exists({ code: candidate });
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      code = Array.from({ length: 6 }, () => safeChars[randomInt(safeChars.length)]).join('');
    }

    const expiresAt = new Date(Date.now() + GUEST_LINK_TTL_MS);

    await this.guestLinkModel.create({
      code,
      parentId: parentOid,
      childId: childOid,
      expiresAt,
    });

    this.logger.log(
      `Guest link code ${code} generated for ${childId ? `child ${childId}` : `parent ${parentId} Family Hub`} (expires in 60s)`,
    );
    return { code, expiresAt };
  }

  /**
   * Validates a guest link code, marks it as used, binds/creates the child
   * profile, and notifies any watching parent screen in real time.
   */
  async validateAndConsumeGuestCode(
    code: string,
    guestInfo?: {
      displayName?: string;
      avatarUrl?: string;
      grade?: string;
    },
  ): Promise<{
    parentId: string;
    childId: string;
    displayName: string;
    avatarUrl: string;
    grade: string;
    tokenVersion: number;
  } | null> {
    const cleanCode = code.trim().toUpperCase();
    const link = await this.guestLinkModel.findOneAndUpdate(
      {
        code: cleanCode,
        used: false,
        expiresAt: { $gt: new Date() },
      },
      { used: true },
      { new: true },
    );

    if (!link) return null;

    const parentId = link.parentId.toString();
    const now = new Date();
    let child: Child | null = null;
    let resolvedChildId = '';

    if (link.childId) {
      resolvedChildId = link.childId.toString();
      child = await this.childModel.findByIdAndUpdate(
        resolvedChildId,
        { $set: { isLinked: true, linkedAt: now, lastActiveAt: now } },
        { new: true },
      );
    } else {
      // Family Hub invitation: promote the guest's local identity to a child profile
      child = await this.childModel.create({
        parentId: link.parentId,
        displayName: guestInfo?.displayName?.trim() || 'Kid',
        avatarUrl: guestInfo?.avatarUrl || 'fox',
        grade: guestInfo?.grade?.trim() || '3rd',
        isLinked: true,
        linkedAt: now,
        lastActiveAt: now,
      });
      resolvedChildId = child._id.toString();
    }

    this.realtimeGateway.emitGuestLinkRedeemed(link.code, {
      parentId,
      childId: resolvedChildId,
      displayName: child?.displayName,
    });

    this.logger.log(
      `Guest link code ${link.code} consumed — child ${resolvedChildId}`,
    );

    return {
      parentId,
      childId: resolvedChildId,
      displayName: child?.displayName ?? '',
      avatarUrl: child?.avatarUrl ?? '',
      grade: child?.grade ?? '',
      tokenVersion: child?.tokenVersion ?? 0,
    };
  }

  /**
   * Allows the generating parent to query whether a link code has been redeemed or expired.
   */
  async getGuestLinkStatus(
    parentId: string,
    code: string,
  ): Promise<{ used: boolean; expired: boolean; expiresAt: Date | null }> {
    const link = await this.guestLinkModel.findOne({
      code: code.trim().toUpperCase(),
      parentId: new Types.ObjectId(parentId),
    });

    if (!link) {
      return { used: false, expired: true, expiresAt: null };
    }

    const expired = link.expiresAt.getTime() <= Date.now();
    return {
      used: !!link.used,
      expired: !link.used && expired,
      expiresAt: link.expiresAt,
    };
  }

  /**
   * Returns target profile info (either pre-selected child or parent Family Hub)
   * for a given link code or child-bound device session without consuming it.
   */
  async getLinkInfo(code: string) {
    const cleanCode = code.trim().toUpperCase();
    const link = await this.guestLinkModel.findOne({
      code: cleanCode,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (link) {
      if (link.childId) {
        const child = await this.childModel.findById(link.childId);
        if (!child) return null;

        return {
          displayName: child.displayName,
          avatarUrl: child.avatarUrl,
          grade: child.grade,
          parentId: link.parentId.toString(),
          childId: link.childId.toString(),
          isFamilyInvite: false,
        };
      }

      const parent = await this.parentModel.findById(link.parentId);
      if (!parent) return null;
      return {
        displayName: parent.displayName,
        avatarUrl: parent.avatarUrl || '',
        parentId: link.parentId.toString(),
        childId: null,
        isFamilyInvite: true,
      };
    }

    if (cleanCode.length === 8) {
      const session = await this.sessionModel.findOne({
        sessionToken: cleanCode,
        isActive: true,
        expiresAt: { $gt: new Date() },
        childId: { $ne: null },
        parentId: { $ne: null },
      });
      if (session?.childId && session?.parentId) {
        const child = await this.childModel.findById(session.childId);
        if (!child) return null;
        return {
          displayName: child.displayName,
          avatarUrl: child.avatarUrl,
          grade: child.grade,
          parentId: session.parentId.toString(),
          childId: session.childId.toString(),
          isFamilyInvite: false,
        };
      }
    }

    return null;
  }

  async updateLastActive(childId: string): Promise<void> {
    if (!Types.ObjectId.isValid(childId)) return;
    await this.childModel.findByIdAndUpdate(childId, {
      lastActiveAt: new Date(),
    });
  }

  async getInactivityMessage(childId: string): Promise<string> {
    const child = await this.childModel.findById(childId);
    if (!child) return 'We miss you! Come back and play! 🚀';

    // Fetch performance stats for personalization
    let stats: any = undefined;
    try {
      stats = await this.matchService.getChildPerformance(
        child.parentId.toString(),
        childId,
      );
    } catch (e) {
      this.logger.warn(`Failed to fetch stats for child ${childId}: ${e.message}`);
    }

    return this.notificationAiService.generateInactivityMessage(
      child.displayName,
      child.grade,
      stats,
    );
  }
}
