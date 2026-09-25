import mariadb from "mariadb";
import { ENV } from "./env.js";

export const pool = mariadb.createPool({
    host: ENV.DB_HOST,
    user: ENV.DB_USER,
    password: ENV.DB_PASSWORD,
    database: ENV.DB_NAME,
    connectionLimit: 10
});

export const ensureDatabaseSchema = async (): Promise<void> => {
    const conn = await pool.getConnection();

    try {
        await conn.query(
            `CREATE TABLE IF NOT EXISTS ResidentHouseholdSetup (
                ResidentID INT PRIMARY KEY,
                OccupancyStatus ENUM('Owner', 'Renter', 'Sharer', 'Boarder') NULL,
                UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ResidentID) REFERENCES Resident(ResidentID) ON DELETE CASCADE
            )`
        );
    } finally {
        conn.release();
    }
};