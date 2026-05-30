import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Attach @UseGuards(JwtAuthGuard) to any controller or route
// to require a valid Bearer JWT. The validated user lands on req.user.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
