import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class GuestLink extends Document {
  /** Short, human-friendly code the parent hands to the kid (e.g. "AB12CD"). */
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Parent', required: true })
  parentId: Types.ObjectId;

  /** Optional child profile ID; null for general Family Hub guest invitations. */
  @Prop({ type: Types.ObjectId, ref: 'Child', default: null })
  childId: Types.ObjectId | null;

  @Prop({ required: true })
  expiresAt: Date;

  /** Consumed on first use so the code can't be reused. */
  @Prop({ default: false })
  used: boolean;
}

export const GuestLinkSchema = SchemaFactory.createForClass(GuestLink);
// TTL index — MongoDB will auto-delete expired docs after a short delay
GuestLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
