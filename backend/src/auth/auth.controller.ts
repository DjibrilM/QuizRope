import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeviceSession } from '../children/schemas/device-session.schema';
import { ChildrenService } from '../children/children.service';

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectModel('DeviceSession')
    private readonly sessionModel: Model<DeviceSession>,
    private readonly childrenService: ChildrenService,
  ) {}

  @Post("login")
  async login(
    @Body()
    body: { token: string; photoUrl?: string; displayName?: string },
  ) {
    const decoded = await this.authService.validateFirebaseToken(
      body.token || "",
    );

    if (this.authService.isFirebaseReady() && decoded.email_verified === false) {
      throw new UnauthorizedException("email_not_verified");
    }

    const parent = await this.authService.findOrCreateParent({
      email: decoded.email,
      displayName: decoded.name || body.displayName || decoded.email,
      firebaseUid: decoded.uid,
      photoUrl: decoded.picture || body.photoUrl,
    });

    const token = this.authService.signToken({
      sub: parent._id.toString(),
      role: "parent",
      email: parent.email,
    });

    return {
      user: parent,
      token,
      mockMode: !this.authService.isFirebaseReady(),
    };
  }

  @Post("refresh")
  @UseGuards(FirebaseAuthGuard)
  async refresh(@Req() req) {
    if (req.user?.role !== "parent") {
      throw new UnauthorizedException("Only parents can refresh parent tokens");
    }
    const parent = req.user;
    if (!parent?._id) {
      throw new UnauthorizedException("Invalid session");
    }

    const token = this.authService.signToken({
      sub: parent._id.toString(),
      role: "parent",
      email: parent.email,
    });

    return { user: parent, token };
  }

  @Post("child-token")
  async getChildToken(@Body() body: { sessionToken: string }) {
    const cleanToken = (body.sessionToken || "").trim().toUpperCase();
    const session = await this.sessionModel.findOne({
      sessionToken: cleanToken,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session || !session.parentId) {
      throw new UnauthorizedException("Session not authorized");
    }

    const childId = session.childId?.toString() || null;
    const child = childId
      ? await this.childrenService.markChildLinked(childId)
      : null;

    const token = this.authService.signToken({
      sub: cleanToken,
      role: "child",
      parentId: session.parentId.toString(),
      ...(childId && { childId, tokenVersion: child?.tokenVersion ?? 0 }),
    });

    return {
      token,
      parentId: session.parentId.toString(),
      childId,
      ...(child && {
        displayName: child.displayName,
        avatarUrl: child.avatarUrl,
        grade: child.grade,
      }),
    };
  }

  /**
   * Guest kid enters a code the parent generated → receives a child JWT.
   * No authentication required — the code is the credential.
   * For Family Hub invitations (without a pre-selected childId), passes the
   * guest's displayName and avatarUrl to create their child profile cleanly.
   */
  @Post("guest-token")
  async getGuestToken(
    @Body()
    body: {
      code: string;
      displayName?: string;
      avatarUrl?: string;
      grade?: string;
    },
  ) {
    if (!body.code) {
      throw new BadRequestException("code is required");
    }

    const resolved = await this.childrenService.validateAndConsumeGuestCode(
      body.code,
      {
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        grade: body.grade,
      },
    );

    if (!resolved) {
      throw new BadRequestException("Invalid or expired link code");
    }

    const { parentId, childId, displayName, avatarUrl, grade, tokenVersion } =
      resolved;

    const token = this.authService.signToken({
      sub: childId,
      role: "child",
      parentId,
      childId,
      tokenVersion,
    });

    return {
      token,
      parentId,
      childId,
      displayName,
      avatarUrl,
      grade,
    };
  }

  /**
   * Returns child profile info for a given link code without consuming it.
   */
  @Get('link-info/:code')
  async getLinkInfo(@Param('code') code: string) {
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const info = await this.childrenService.getLinkInfo(code);
    if (!info) {
      throw new BadRequestException('Invalid or expired link code');
    }
    return info;
  }

  @Get("me")
  @UseGuards(FirebaseAuthGuard)
  async getMe(@Req() req) {
    if (req.user?.role === "parent") {
      const parentId = req.user.id || req.user._id?.toString();
      if (parentId) {
        const refreshed = await this.authService.ensureParentAvatar(parentId);
        if (refreshed) return refreshed;
      }
    }
    return req.user;
  }

  @Patch("profile")
  @UseGuards(FirebaseAuthGuard)
  async updateProfile(
    @Req() req,
    @Body() body: { displayName?: string; avatarUrl?: string },
  ) {
    if (req.user?.role !== "parent") {
      throw new UnauthorizedException("Only parents can update parent profile");
    }
    const parentId = req.user.id || req.user._id?.toString();
    if (!parentId) {
      throw new UnauthorizedException("Invalid parent session");
    }
    return this.authService.updateParentProfile(parentId, body || {});
  }

  @Get("status")
  getStatus() {
    return {
      firebaseConfigured: this.authService.isFirebaseReady(),
      mockMode: !this.authService.isFirebaseReady(),
    };
  }

  @Post("send-otp")
  async sendOtp(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException("Email is required");
    }
    await this.authService.sendPasswordResetEmail(body.email);
    return { success: true, message: "Password reset email sent." };
  }

  /**
   * Ghost (guest) device registers its local guestId and gets a ghost JWT.
   * No authentication required — used immediately after guest profile creation.
   */
  @Post("ghost-token")
  ghostToken(@Body() body: { guestId: string; displayName: string }) {
    if (!body.guestId) {
      throw new BadRequestException("guestId is required");
    }
    const token = this.authService.signToken({
      sub: body.guestId,
      role: "ghost" as any,
      guestId: body.guestId,
    } as any);
    return { token };
  }

  /**
   * After a ghost links to a child account, migrate all ghost data to the real child.
   * Requires the child JWT (obtained from guest-token) in the Authorization header.
   */
  @Post("ghost-migrate")
  async ghostMigrate(
    @Body() body: { guestId: string },
    @Req() req,
  ) {
    if (!body.guestId) {
      throw new BadRequestException("guestId is required");
    }

    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Child token required");
    }

    let decoded: any;
    try {
      decoded = this.authService.verifyToken(authHeader.split("Bearer ")[1]);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    if (decoded.role !== "child" || !decoded.parentId || !decoded.childId) {
      throw new UnauthorizedException("Valid child token required");
    }

    const result = await this.authService.migrateGuestData(
      body.guestId,
      decoded.parentId,
      decoded.childId,
    );

    return result;
  }

  /**
   * Migrate local SQLite guest data to MongoDB after the guest links to a child account.
   * Requires the child JWT in the Authorization header.
   */
  @Post("migrate-local")
  async migrateLocal(
    @Body() body: {
      matches: any[];
      questions: any[];
      answers: any[];
      homeworkSessions: any[];
      chats: any[];
    },
    @Req() req,
  ) {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Child token required");
    }

    let decoded: any;
    try {
      decoded = this.authService.verifyToken(authHeader.split("Bearer ")[1]);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    if (decoded.role !== "child" || !decoded.parentId || !decoded.childId) {
      throw new UnauthorizedException("Valid child token required");
    }

    return this.authService.migrateLocalData(decoded.parentId, decoded.childId, {
      matches: body.matches || [],
      questions: body.questions || [],
      answers: body.answers || [],
      homeworkSessions: body.homeworkSessions || [],
      chats: body.chats || [],
    });
  }
}
