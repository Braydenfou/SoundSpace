import postgres from "postgres";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeAll } from "vitest";
import AuthController from "../src/controllers/AuthController";
import User, { UserProps } from "../src/models/User";

describe("Auth HTTP operations", () => {
    const sql = postgres({
        database: "MyDB",
    });

    const server = new Server({
        host: "localhost",
        port: 3000,
        sql,
    });

    const createUser = async (props: Partial<UserProps> = {}) => {
        return await User.create(sql, {
            username: props.username || "testuser",
            email: props.email || "user@email.com",
            password: props.password || "password",
        });
    };

    beforeAll(async () => {
        await server.start();
    });

    afterEach(async () => {
        const tables = ["users"];

        try {
            for (const table of tables) {
                await sql.unsafe(`DELETE FROM ${table}`);
                await sql.unsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`);
            }
        } catch (error) {
            console.error(error);
        }
        await makeHttpRequest("POST", "/logout");
        clearCookieJar();
    });

    //#region Authentication
    test("User was registered.", async () => {
        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/register`,
            {
                username: "testuser",
                email: "user@email.com",
                password: "password",
                confirmPassword: "password",
            },
        );

        expect(statusCode).toBe(StatusCode.Created);
        expect(body.message).toBe("User created");
    });

    test("User registration failed due to missing password.", async () => {
        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/register`,
            {
                username: "testuser",
                email: "user@email.com",
            },
        );

        expect(statusCode).toBe(StatusCode.BadRequest);
        expect(body.message).toBe("Missing password.");
    });

    test("User registration failed due to duplicate email.", async () => {
        await createUser();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/register`,
            {
                username: "testuser",
                email: "user@email.com",
                password: "password",
                confirmPassword: "password",
            },
        );

        expect(statusCode).toBe(StatusCode.BadRequest);
        expect(body.message).toBe("User with this email already exists.");
    });

    test("User was logged in.", async () => {
        await createUser();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/login`,
            {
                email: "user@email.com",
                password: "password",
            },
        );

        expect(statusCode).toBe(StatusCode.OK);
        expect(body.message).toBe("Logged in successfully!");
    });

    test("User login failed due to invalid credentials.", async () => {
        await createUser();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/login`,
            {
                email: "user@email.com",
                password: "wrongpassword",
            },
        );

        expect(statusCode).toBe(StatusCode.BadRequest);
        expect(body.message).toBe("Invalid credentials.");
    });

    //#endregion
});
