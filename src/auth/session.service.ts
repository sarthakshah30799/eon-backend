import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

@Injectable()
export class SessionService {
  constructor(private readonly dataSource: DataSource) {}

  async invalidateUserSessions(userId: number, currentSessionId?: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete all sessions for the user except the current one
      await queryRunner.query(
        `DELETE FROM user_sessions 
         WHERE sess::jsonb ? 'userId' 
         AND (sess::jsonb->>'userId')::integer = $1
         ${currentSessionId ? 'AND sid != $2' : ''}`,
        currentSessionId ? [userId, currentSessionId] : [userId]
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserActiveSessions(userId: number): Promise<any[]> {
    const result = await this.dataSource.query(
      `SELECT sid, sess, expire 
       FROM user_sessions 
       WHERE sess::jsonb ? 'userId' 
       AND (sess::jsonb->>'userId')::integer = $1
       AND expire > NOW()
       ORDER BY expire DESC`,
      [userId]
    );
    return result;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.dataSource.query(
      'DELETE FROM user_sessions WHERE sid = $1',
      [sessionId]
    );
  }

  async getSessionInfo(sessionId: string): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT sid, sess, expire 
       FROM user_sessions 
       WHERE sid = $1`,
      [sessionId]
    );
    return result[0] || null;
  }
}
