import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ChildrenService } from './children.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Controller('children')
export class ChildrenController {
  constructor(
    private readonly childrenService: ChildrenService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private getParentId(req: any): string {
    const id = req.user?._id ?? req.user?.id;
    if (!id) {
      throw new ForbiddenException('Parents only');
    }
    return id.toString();
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  async createChild(
    @Req() req,
    @Body() body: { displayName: string; grade: string; avatarUrl?: string },
  ) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    return this.childrenService.createChild(this.getParentId(req), body);
  }

  @Get()
  @UseGuards(FirebaseAuthGuard)
  async getChildren(@Req() req) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    return this.childrenService.getChildrenByParent(this.getParentId(req));
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  async deleteChild(@Req() req, @Param('id') id: string) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    const child = await this.childrenService.deleteChild(
      this.getParentId(req),
      id,
    );
    if (!child) {
      throw new NotFoundException('Child not found');
    }
    return { success: true };
  }

  @Post(':id/unlink')
  @UseGuards(FirebaseAuthGuard)
  async unlinkChildDevices(@Req() req, @Param('id') id: string) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    const child = await this.childrenService.unlinkChildDevices(
      this.getParentId(req),
      id,
    );
    return { success: true, child };
  }

  @Post('qr-session')
  @UseGuards(FirebaseAuthGuard)
  async createQRSession(@Req() req) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    return this.childrenService.createQRSession(this.getParentId(req));
  }

  @Post('link')
  async linkChild(@Body() body: { sessionToken: string; childId: string }) {
    return this.childrenService.linkChildToSession(
      body.sessionToken,
      body.childId,
    );
  }

  @Get('session/:token')
  async validateSession(@Param('token') token: string) {
    const session = await this.childrenService.validateSession(token);
    return { valid: !!session, session };
  }

  // --- Child-initiated session endpoints ---

  @Post('session')
  async createChildSession() {
    const session = await this.childrenService.createUnauthenticatedSession();
    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  @Get('session/:token/status')
  async getSessionStatus(@Param('token') token: string) {
    return this.childrenService.getSessionStatus(token);
  }

  @Post('session/authorize')
  @UseGuards(FirebaseAuthGuard)
  async authorizeSession(
    @Req() req,
    @Body() body: { sessionToken: string; childId?: string },
  ) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    const parentId = this.getParentId(req);
    const session = await this.childrenService.authorizeSession(
      body.sessionToken,
      parentId,
      body.childId,
    );

    if (!session) {
      throw new NotFoundException('Session not found or already authorized');
    }

    // Emit real-time event to the child's device
    this.realtimeGateway.emitSessionAuthorized(body.sessionToken, {
      parentId,
      childId: body.childId || null,
    });

    return { success: true, session };
  }

  // --- Guest link code endpoints ---

  /**
   * Parent calls this to generate a 1-minute invitation code + QR for either
   * a specific child profile or any guest device joining their Family Hub.
   */
  @Post('guest-link')
  @UseGuards(FirebaseAuthGuard)
  async generateGuestLinkCode(
    @Req() req,
    @Body() body: { childId?: string },
  ) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    return this.childrenService.generateGuestLinkCode(
      this.getParentId(req),
      body?.childId,
    );
  }

  @Get('guest-link/:code/status')
  @UseGuards(FirebaseAuthGuard)
  async getGuestLinkStatus(@Req() req, @Param('code') code: string) {
    if (req.user.role !== 'parent') throw new ForbiddenException('Parents only');
    return this.childrenService.getGuestLinkStatus(
      this.getParentId(req),
      code,
    );
  }

  @Post(':id/active')
  @UseGuards(FirebaseAuthGuard)
  async updateActive(@Param('id') id: string) {
    return this.childrenService.updateLastActive(id);
  }

  @Get(':id/inactivity-message')
  @UseGuards(FirebaseAuthGuard)
  async getInactivityMessage(@Param('id') id: string) {
    const message = await this.childrenService.getInactivityMessage(id);
    return { message };
  }
}
