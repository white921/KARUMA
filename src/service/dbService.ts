import mysql from "mysql2/promise";
import { normalizePositiveInteger } from "../util/runtimeConfig";

const DEFAULT_MYSQL_CONNECTION_LIMIT = 5;
const DEFAULT_MYSQL_SLOW_ACQUIRE_LOG_MS = 1_000;

export function resolveMysqlConnectionLimit(value?: string): number {
  return normalizePositiveInteger(value, DEFAULT_MYSQL_CONNECTION_LIMIT, 1);
}

export function resolveMysqlSlowAcquireLogMs(value?: string): number {
  return normalizePositiveInteger(value, DEFAULT_MYSQL_SLOW_ACQUIRE_LOG_MS, 0);
}

export class DbService {
  // static async getConnection() {
  //   return mysql.createConnection({
  //     host: process.env.MYSQL_HOST,
  //     user: process.env.MYSQL_USER,
  //     password: process.env.MYSQL_PASSWORD,
  //     database: process.env.MYSQL_DATABASE,
  //     port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined,
  //     supportBigNumbers: true,
  //     bigNumberStrings: true,
  //   });
  // }
  private static pool: mysql.Pool | null = null;
  private static activeConnections = 0;

  private static getPool() {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined,

        waitForConnections: true,
        connectionLimit: resolveMysqlConnectionLimit(
          process.env.MYSQL_CONNECTION_LIMIT,
        ),
        queueLimit: 0,

        supportBigNumbers: true,
        bigNumberStrings: true,
      });
    }

    return this.pool;
  }

  static async getConnection() {
    const startedAt = Date.now();
    try {
      const connection = await this.getPool().getConnection();
      const acquireMs = Date.now() - startedAt;
      const slowAcquireLogMs = resolveMysqlSlowAcquireLogMs(
        process.env.MYSQL_SLOW_ACQUIRE_LOG_MS,
      );

      this.activeConnections += 1;
      if (acquireMs >= slowAcquireLogMs) {
        console.warn("[DbService] slow mysql connection acquire", {
          acquireMs,
          activeConnections: this.activeConnections,
          connectionLimit: resolveMysqlConnectionLimit(
            process.env.MYSQL_CONNECTION_LIMIT,
          ),
        });
      }

      const originalRelease = connection.release.bind(connection);
      let released = false;
      connection.release = () => {
        if (released) {
          return;
        }
        released = true;
        this.activeConnections = Math.max(0, this.activeConnections - 1);
        originalRelease();
      };

      return connection;
    } catch (error) {
      console.error("[DbService] mysql connection acquire failed", {
        acquireMs: Date.now() - startedAt,
        activeConnections: this.activeConnections,
        error,
      });
      throw new Error("DB接続エラー");
    }
  }
}
