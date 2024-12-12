import postgres from "postgres";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeAll } from "vitest";
import UserController from "../src/controllers/UserController";
import User, { UserProps } from "../src/models/User";

describe("User HTTP operations", () => {
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

    const login = async (
        email: string = "user@email.com",
        password: string = "password",
    ) => {
        await makeHttpRequest("POST", "/login", {
            email,
            password,
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

    //#region User
    test("User was created.", async () => {
        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/users`,
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

    test("User creation failed due to missing password.", async () => {
        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/users`,
            {
                username: "testuser",
                email: "user@email.com",
            },
        );

        expect(statusCode).toBe(StatusCode.BadRequest);
        expect(body.message).toBe("Missing password.");
    });

    test("User creation failed due to duplicate email.", async () => {
        await createUser();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/users`,
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

    test("User account details retrieved successfully.", async () => {
        const user = await createUser();
        await login(user.props.email, user.props.password);

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "GET",
            `/account`,
        );

        expect(statusCode).toBe(StatusCode.OK);
        expect(body.message).toBe("Account Details");
        expect(body.payload.user.email).toBe(user.props.email);
    });

    test("Account details retrieval failed for unauthenticated user.", async () => {
        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "GET",
            `/account`,
        );

        expect(statusCode).toBe(StatusCode.Unauthorized);
        expect(body.message).toBe("Please log in to view your account");
    });

    //#endregion
});
