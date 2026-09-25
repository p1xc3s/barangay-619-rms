import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 3000,

  DB_HOST: process.env.DB_HOST || "localhost",
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "rms_db",

  JWT_SECRET: process.env.JWT_SECRET || "dev_secret",

  //Backup & Restore
  BACKUP_ENCRYPTION_KEY: "7x!A%C*F-JaNdRgUkXp2s5v8y/B?E(G+",
  BACKUP_ENCRYPTION_IV: "q3t6w9z$C&F)J@Nc",
  BACKUP_DIR: process.env.BACKUP_DIR || "backups",
  MYSQLDUMP_PATH:
    process.env.MYSQLDUMP_PATH || "C:/xampp/mysql/bin/mysqldump.exe",
  MYSQL_PATH: process.env.MYSQL_PATH || "C:/xampp/mysql/bin/mysql.exe",
};
