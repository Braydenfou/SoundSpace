import postgres from "postgres";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeAll } from "vitest";
import SongController from "../src/controllers/SongController";
import User, { UserProps } from "../src/models/User";
import Song, { SongProps } from "../src/models/Song";
import Rating, { RatingProps } from "../src/models/Rating";

describe("Song HTTP operations", () => {
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

    const createSong = async (props: Partial<SongProps> = {}) => {
        const [row] = await sql`
            INSERT INTO songs (title, artist, year)
            VALUES (${props.title || "Test Song"}, ${props.artist || "Test Artist"}, ${props.year || 2021})
            RETURNING *;
        `;
        return new Song(sql, row as SongProps)
    };

    const createRating = async (props: Partial<RatingProps> = {}) => {
        return await Rating.create(sql, {
            userId: props.userId || 1,
            songId: props.songId || 1,
            rating: props.rating || 5,
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
        const tables = ["users", "songs", "ratings"];

        try {
            for (const table of tables) {
                await sql.unsafe(`DELETE FROM ${table}`);
                await sql.unsafe(
                    `ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`,
                );
            }
        } catch (error) {
            console.error(error);
        }
        await makeHttpRequest("POST", "/logout");
        clearCookieJar();
    });

    //#region Songs
    test("Song was retrieved.", async () => {
        await createUser();
        await login();
        const song = await createSong();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "GET",
            `/songs/${song.props.id}`,
        );

        expect(statusCode).toBe(StatusCode.OK);
        expect(body.message).toBe("Song Details");
        expect(body.payload.song.title).toBe(song.props.title);
    });

    test("Song retrieval failed due to non-existent ID.", async () => {
        await createUser();
        await login();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "GET",
            `/songs/999`,
        );

        expect(statusCode).toBe(StatusCode.NotFound);
        expect(body.message).toBe("Song not found");
    });

    test("Song search successful.", async () => {
        await createUser();
        await login();
        await createSong({ title: "Searchable Song" });

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            "/songs/search",
            { query: "Searchable Song" },
        );

        expect(statusCode).toBe(StatusCode.OK);
        expect(body.message).toBe("Search Results");
        expect(body.payload.song.title).toBe("Searchable Song");
    });

    test("Song search failed due to missing query parameter.", async () => {
        await createUser();
        await login();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            "/songs/search",
            {},
        );

        expect(statusCode).toBe(StatusCode.BadRequest);
        expect(body.message).toBe("Query parameter is missing");
    });

    test("Song search failed due to no matching song.", async () => {
        await createUser();
        await login();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            "/songs/search",
            { query: "Nonexistent Song" },
        );

        expect(statusCode).toBe(StatusCode.NotFound);
        expect(body.message).toBe("No song found matching the query");
    });

    test("Rating was added successfully.", async () => {
        await createUser();
        await login();
        const song = await createSong();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/songs/${song.props.id}/rate`,
            { rating: 4 },
        );

        expect(statusCode).toBe(StatusCode.Created);
        expect(body.message).toBe("Rating added successfully");
    });

    test("Rating addition failed for unauthenticated user.", async () => {
        const song = await createSong();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/songs/${song.props.id}/rate`,
            { rating: 4 },
        );

        expect(statusCode).toBe(StatusCode.Unauthorized);
        expect(body.message).toBe("Please log in to rate the song");
    });

    test("Rating addition failed due to invalid song ID.", async () => {
        await createUser();
        await login();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/songs/999/rate`,
            { rating: 4 },
        );

        expect(statusCode).toBe(StatusCode.BadRequest);
        expect(body.message).toBe("Error adding rating");
    });
    //#endregion
});
