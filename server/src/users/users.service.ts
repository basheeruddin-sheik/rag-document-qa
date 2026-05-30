import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<User>(
      `SELECT id, email, password_hash, created_at FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: number): Promise<User | null> {
    const result = await this.db.query<User>(
      `SELECT id, email, password_hash, created_at FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const result = await this.db.query<User>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *`,
      [email, passwordHash],
    );
    return result.rows[0];
  }
}
