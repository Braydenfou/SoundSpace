import { strictEqual } from "assert";
import { tracingChannel } from "diagnostics_channel";
import postgres from "postgres";
import { REPL_MODE_SLOPPY } from "repl";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";


export interface SongProps {
    id?: number;
    title: string;
    artist: string;
    year: number 
}

export default class Song {
    constructor(
        private sql: postgres.Sql<any>,
        public props: SongProps,
    ) {}

    static async findById(sql: postgres.Sql<any>, id: string): Promise<Song | null> {
        if (!id) {
            throw new Error("Invalid ID");
        }
        const [row] = await sql`SELECT * FROM songs WHERE id = ${id}`;
        return row ? new Song(sql, convertToCase(snakeToCamel, row) as SongProps) : null;
    }

    static async search(sql: postgres.Sql<any>, trackName: string): Promise<Song | null> {
        const connection = await sql.reserve();

        try {
            const [row] = await connection`
                SELECT * FROM songs WHERE title ILIKE ${'%' + trackName + '%'} ORDER BY title LIMIT 1
            `;

            if (!row) {
                return null;
            }

            return new Song(sql, convertToCase(snakeToCamel, row) as SongProps);
        } catch (error) {
            console.error("Error in Song.search:", error);
            throw error;
        } finally {
            await connection.release();
        }
    }

    static async getTopSongs(sql: postgres.Sql<any>): Promise<Song[]> {
        const rows = await sql`
        SELECT s.*, AVG(r.rating) AS avg_rating
        FROM songs s
        JOIN ratings r ON s.id = r.song_id
        GROUP BY s.id
        ORDER BY avg_rating DESC
        LIMIT 10;
        `;
        return rows.map(row => new Song(sql, convertToCase(snakeToCamel, row) as SongProps));
    }

}