import mysql from "mysql2/promise";

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
  private static pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  static async getConnection() {
    try {
      return await this.pool.getConnection();
    } catch (error) {
      throw new Error("DB接続エラー");
    }
  }
}
