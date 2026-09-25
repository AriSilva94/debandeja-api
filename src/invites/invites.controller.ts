import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BRUTE_FORCE_THROTTLE } from '../common/http/throttle';
import { Public } from '../auth/decorators/public.decorator';
import { InvitesService } from './invites.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Public()
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle(BRUTE_FORCE_THROTTLE)
  accept(@Body() dto: AcceptInviteDto) {
    return this.invitesService.accept(dto);
  }
}
