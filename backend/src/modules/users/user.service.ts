import bcrypt from "bcrypt";
import { UserRepository } from "./user.repository.js";

const SALT_ROUNDS = 10;

export const UserService = {
    async createUser(username: string, password: string, role: "Admin" | "Staff") {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        return UserRepository.create(username, hashedPassword, role);
    },

    async validateUser(username: string, password: string) {
        const user = await UserRepository.findByUsername(username);
        if (!user) return null;

        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) return null;

        return user;
    },

    async getAllUsers() {
        return UserRepository.findAll();
    },

    async getUserById(userId: number) {
        const user = await UserRepository.findById(userId);
        if (!user) throw { status: 404, message: "User not found" };
        return user;
    },

    async updateUser(
        userId: number,
        data: {
            username?: string;
            password?: string;
            role?: "Admin" | "Staff";
            isFirstLogin?: boolean;
        }
    ) {
        const existing = await UserRepository.findById(userId);
        if (!existing) throw { status: 404, message: "User not found" };

        //Hash password if provided
        if (data.password) {
            data.password = await bcrypt.hash(data.password, SALT_ROUNDS);
        }

        const updated = await UserRepository.update(userId, data);
        if (!updated) throw { status: 500, message: "No changes made" };

        return true;
    },

    async updateUserStatus(
        userId: number,
        status: "Active" | "Inactive"
    ) {
        const existing = await UserRepository.findById(userId);
        if (!existing) throw { status: 404, message: "User not found" };

        const updated = await UserRepository.updateStatus(userId, status);
        if (!updated) throw { status: 500, message: "No changes made" };

        return true;
    }
};