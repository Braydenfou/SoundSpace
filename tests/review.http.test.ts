import postgres from "postgres";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, clearCookieJar, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, beforeAll } from "vitest";
import ReviewController from "../src/controllers/ReviewController";
import User, { UserProps } from "../src/models/User";
import Song, { SongProps } from "../src/models/Song";
import Review, { ReviewProps } from "../src/models/Review";

describe("Review HTTP operations", () => {
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
        return new Song(sql, row as SongProps);
    };

    const createReview = async (props: Partial<ReviewProps> = {}) => {
        const [row] = await sql`
            INSERT INTO reviews (user_id, song_id, content)
            VALUES (${props.userId || 1}, ${props.songId || 1}, ${props.content || "Great song!"})
            RETURNING *;
        `;
        return new Review(sql, row as ReviewProps);
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
        const tables = ["users", "songs", "reviews"];

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

    //#region Reviews
    test("Review was added successfully.", async () => {
        await createUser();
        await login();
        const song = await createSong();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/songs/${song.props.id}/review`,
            { content: "Amazing song!" },
        );

        expect(statusCode).toBe(StatusCode.Created);
        expect(body.message).toBe("Review added successfully");
        expect(body.payload.review.content).toBe("Amazing song!");
    });

    test("Review addition failed for unauthenticated user.", async () => {
        const song = await createSong();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "POST",
            `/songs/${song.props.id}/review`,
            { content: "Amazing song!" },
        );

        expect(statusCode).toBe(StatusCode.Unauthorized);
        expect(body.message).toBe("Please log in to add a review");
    });


    test("Review deletion failed due to invalid ID.", async () => {
        await createUser();
        await login();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "DELETE",
            `/reviews/999`,
        );

        expect(statusCode).toBe(StatusCode.BadRequest);
        expect(body.message).toBe("Error deleting review");
    });

    test("Reviews were retrieved successfully for a song.", async () => {
        await createUser();
        await login();
        const song = await createSong();
        await createReview({ songId: song.props.id });

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "GET",
            `/songs/${song.props.id}/reviews`,
        );

        expect(statusCode).toBe(StatusCode.OK);
        expect(body.message).toBe("Song Reviews");
        expect(body.payload.reviews).toBeInstanceOf(Array);
        expect(body.payload.reviews[0].content).toBe("Great song!");
    });

    test("Reviews retrieval failed due to invalid song ID.", async () => {
        await createUser();
        await login();

        const { statusCode, body }: HttpResponse = await makeHttpRequest(
            "GET",
            `/songs/999/reviews`,
        );

        expect(statusCode).toBe(StatusCode.NotFound);
        expect(body.message).toBe("Song not found");
    });
    //#endregion
});
