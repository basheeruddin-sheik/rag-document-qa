import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10; // bcrypt work-factor — higher = slower but safer

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    // bcrypt hashes the password — the original is never stored anywhere
    const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.users.create(dto.email, hash);

    this.logger.log(`New user registered: ${dto.email}`);
    return { user: { id: user.id, email: user.email }, access_token: this.sign(user) };
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    this.logger.log(`User logged in: ${dto.email}`);
    return { user: { id: user.id, email: user.email }, access_token: this.sign(user) };
  }

  // ── Sign JWT ─────────────────────────────────────────────────────────────
  private sign(user: { id: number; email: string }): string {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }
}
