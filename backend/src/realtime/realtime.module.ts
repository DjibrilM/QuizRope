import { Module, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { ChildrenModule } from '../children/children.module';
import { HomeworkModule } from '../homework/homework.module';

@Module({
  imports: [forwardRef(() => ChildrenModule), forwardRef(() => HomeworkModule)],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
