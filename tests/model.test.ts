import postgres from "postgres";
import { describe, test, expect, afterEach, afterAll, beforeEach } from "vitest";
import User, { UserProps, DuplicateEmailError, InvalidCredentialsError } from "../src/models/User";
import Song, { SongProps } from "../src/models/Song";
import Review, {ReviewProps} from "../src/models/Review";
import Rating, {RatingProps} from "../src/models/Rating";
import { createUTCDate } from "../src/utils";

describe("CRUD operations for models", () => {
    const sql = postgres({
        database: "MyDB",
        max: 10,
        idle_timeout: 5
    });

    afterEach(async () => {
        const tables = ["users", "songs", "ratings", "reviews"];
        try {
            for (const table of tables) {
                await sql.unsafe(`DELETE FROM ${table}`);
                await sql.unsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`);
            }
        } catch (error) {
            console.error(error);
        }
    }, 10000);

    //#region User

    const createUser = async (props: Partial<UserProps> = {}) => {
        return await User.create(sql, {
            username: props.username || "username",
            email: props.email || "user@example.com",
            password: props.password || "password123",
        });
    };

    test("User was created.", async () => {
        const user = await createUser();

        expect(user.props.username).toBe("username");
        expect(user.props.email).toBe("user@example.com");
        expect(user.props.password).toBe("password123");
    }, 30000);

    test("User was not created with duplicate email.", async () => {
        await createUser({ email: "user@example.com" });

        await expect(async () => {
            await createUser({ email: "user@example.com" });
        }).rejects.toThrow(DuplicateEmailError);
    }, 30000);

    test("User was logged in.", async () => {
        const user = await createUser({ password: "Password123" });
        const loggedInUser = await User.login(sql, user.props.email, "Password123");

        expect(loggedInUser?.props.email).toBe("user@example.com");
        expect(loggedInUser?.props.password).toBe("Password123");
    }, 30000);

    test("User was not logged in with invalid password.", async () => {
        const user = await createUser({ password: "Password123" });

        await expect(async () => {
            await User.login(sql, user.props.email, "wrongpassword");
        }).rejects.toThrow(InvalidCredentialsError);
    }, 30000);

    test("User was not logged in with invalid email.", async () => {
        await createUser({ email: "user@example.com", password: "Password123" });

        await expect(async () => {
            await User.login(sql, "invalid@example.com", "Password123");
        }).rejects.toThrow(InvalidCredentialsError);
    }, 30000);

    //#endregion

    //#region Song

    const createSong = async (props: Partial<SongProps> = {}) => {
        return await sql`INSERT INTO songs (title, artist, year) VALUES (${props.title || "Test Song"}, ${props.artist || "Test Artist"}, ${props.year || 2023}) RETURNING *`
            .then(([row]) => new Song(sql, row as SongProps));
    };

    test("Song was created.", async () => {
        const song = await createSong({ title: "New Song", artist: "New Artist", year: 2022 });

        expect(song.props.title).toBe("New Song");
        expect(song.props.artist).toBe("New Artist");
        expect(song.props.year).toBe(2022);
    }, 30000);

    test("Song was retrieved by ID.", async () => {
        const song = await createSong({ title: "New Song", artist: "New Artist", year: 2022 });
        const retrievedSong = await Song.findById(sql, song.props.id!.toString());

        expect(retrievedSong).not.toBeNull();
        expect(retrievedSong?.props.title).toBe("New Song");
        expect(retrievedSong?.props.artist).toBe("New Artist");
        expect(retrievedSong?.props.year).toBe(2022);
    }, 30000);

    test("Song was not retrieved by invalid ID.", async () => {
        await expect(Song.findById(sql, "999")).resolves.toBeNull();
    }, 30000);

    test("Song was searched by track name.", async () => {
        const song = await createSong({ title: "Unique Song", artist: "Unique Artist", year: 2021 });
        const searchedSong = await Song.search(sql, "Unique Song");

        expect(searchedSong).not.toBeNull();
        expect(searchedSong?.props.title).toBe("Unique Song");
    }, 30000);

    test("Song search returned null for non-existent track name.", async () => {
        const searchedSong = await Song.search(sql, "Non-Existent Song");
        expect(searchedSong).toBeNull();
    }, 30000);

    
    //#endregion
    
    //#region Rating
    
    const createRating = async (props: Partial<RatingProps> = {}) => {
        const user = await createUser();
        const song = await createSong();
        return await Rating.create(sql, {
            userId: user.props.id!,
            songId: props.songId || 1,
            rating: props.rating || 5,
        });
    };
    
    test("Rating was created.", async () => {
        const rating = await createRating({ rating: 8 });
        
        expect(rating.props.userId).toBeTruthy();
        expect(rating.props.songId).toBe(1);
        expect(rating.props.rating).toBe(8);
    }, 30000);
    
    test("Rating was found by song ID.", async () => {
        const rating = await createRating({ rating: 8, songId: 1 });
        const ratings = await Rating.findBySongId(sql, 1);
        
        expect(ratings).toBeInstanceOf(Array);
        expect(ratings.length).toBeGreaterThan(0);
        expect(ratings[0].props.songId).toBe(1);
        expect(ratings[0].props.rating).toBe(8);
    }, 30000);
    
    test("Should handle error when finding ratings by invalid song ID", async () => {
        await expect(Rating.findBySongId(sql, 999)).resolves.toEqual([]);
    }, 30000);
    
    //#endregion

    test("Top songs were retrieved.", async () => {
        const song1 = await createSong({ title: "Song 1", artist: "Artist 1", year: 2020 });
        const song2 = await createSong({ title: "Song 2", artist: "Artist 2", year: 2021 });

        await Rating.create(sql, { userId: 1, songId: song1.props.id!, rating: 5 } as RatingProps);
        await Rating.create(sql, { userId: 2, songId: song2.props.id!, rating: 4 } as RatingProps);

        const topSongs = await Song.getTopSongs(sql);

        expect(topSongs).toHaveLength(2);
        expect(topSongs[0].props.title).toBe("Song 1");
        expect(topSongs[1].props.title).toBe("Song 2");
    }, 30000);
    
    //#region Review
    
    const createReview = async (props: Partial<ReviewProps> = {}) => {
        const user = props.userId ? { id: props.userId } : await createUser();
        const song = props.songId ? { id: props.songId } : await createSong();

        return await Review.create(sql, {
            userId: props.userId || 1,
            songId: props.songId || 1,
            content: props.content || "This is a test review.",
        });
    };

    test("Review was created.", async () => {
        await User.create(sql, { username: "testuser", email: "testuser@example.com", password: "password123" });
        const review = await createReview({ content: "Great song!" });

        expect(review.props.content).toBe("Great song!");
        expect(review.props.userId).toBe(1);
        expect(review.props.songId).toBe(1);
    }, 30000);

    test("Review was deleted.", async () => {
        await User.create(sql, { username: "testuser", email: "testuser@example.com", password: "password123" });
        const song1 = await createSong({ title: "Song 1", artist: "Artist 1", year: 2020 });

        const review = await createReview();

        await Review.delete(sql, review.props.id!);

        await expect(async () => {
            await Review.delete(sql, review.props.id!);
        }).rejects.toThrow("Invalid credentials.");
    }, 30000);

    //#endregion

    afterAll(async () => {
        await sql.end();
    });
});