import { pool } from "../../config/database.js";

export const UserRepository = {
  async create(username: string, password: string, role: "Admin" | "Staff") {
    const conn = await pool.getConnection();
    try {
      const result = await conn.query(
        `INSERT INTO UserAccount (Username, Password, Role) VALUES (?, ?, ?)`,
        [username, password, role],
      );
      return Number(result.insertId);
    } catch (err: any) {
        if (err.errno === 1062) {
            throw { status: 409, message: "Username already exists!" };
        }
        throw err;
    } finally {
      conn.release();
    }
  },

  async findByUsername(username: string) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT * FROM UserAccount WHERE Username = ? AND AccStatus = 'Active'`,
        [username],
      );
      return rows[0];
    } finally {
      conn.release();
    }
  },

  async findAll() {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT u.UserID, u.Username, u.Role, u.AccStatus,
          (SELECT MAX(a.Timestamp) FROM AuditTrail a
           WHERE a.UserID = u.UserID AND a.Action = 'USER_LOGIN') AS LastLogin
        FROM UserAccount u
        ORDER BY u.UserID`
      );

      return rows;
    } finally {
      conn.release();
    }
  },

  async findById(userId: number) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT UserID, Username, Role, AccStatus, IsFirstLogin FROM UserAccount WHERE UserID = ?`,
        [userId]
      );

      return rows[0] || null;
    } finally {
      conn.release();
    }
  },

  async update(
    userId: number,
    data: {
      username?: string;
      password?: string;
      role?: "Admin" | "Staff";
      isFirstLogin?: boolean;
    }
  ) {
    const conn = await pool.getConnection();
    try {
      const fields: string[] = [];
      const params: any[] = [];

      if (data.username) {
        fields.push("Username = ?");
        params.push(data.username);
      }

      if (data.password) {
        fields.push("Password = ?");
        params.push(data.password);
      }

      if (data.role) {
        fields.push("Role = ?");
        params.push(data.role);
      }

      if (data.isFirstLogin !== undefined) {
        fields.push("IsFirstLogin = ?");
        params.push(data.isFirstLogin ? 1 : 0);
      }

      if (fields.length === 0) return false;

      params.push(userId);
      const result = await conn.query(
        `UPDATE UserAccount SET ${fields.join(", ")} WHERE UserID = ?`,
        params
      );

      return result.affectedRows > 0;
    } finally {
      conn.release();
    }
  },

  async updateStatus(
    userId: number,
    status: "Active" | "Inactive"
  ) {
    const conn = await pool.getConnection();
    try {
      const result = await conn.query(
        `UPDATE UserAccount SET AccStatus = ? WHERE UserID = ?`,
        [status, userId]
      );

      return result.affectedRows > 0;
    } finally {
      conn.release();
    }
  }
};
