import postgres from "postgres";
import {
    camelToSnake,
    convertToCase,
    snakeToCamel,
} from "../utils"
import { InvalidCredentialsError } from "./User";


export interface ReviewProps {
    id?: number,
    userId: number,
    songId: number,
    content: string
}


export default class Review {
    constructor(
        private sql: postgres.Sql<any>,
        public props: ReviewProps
    ) {}


    static async create(sql: postgres.Sql<any>, props: ReviewProps): Promise<Review> {
        const connection = await sql.reserve()
        try {
            const [review] = await connection`INSERT INTO reviews (user_id, song_id, content)
            VALUES (${props.userId}, ${props.songId}, ${props.content})
            RETURNING *`;

            await connection.release()
            return new Review(sql, convertToCase(snakeToCamel, review) as ReviewProps)

        } catch (error) {
            throw error
        }
    }


    static async delete(sql: postgres.Sql<any>, id: number): Promise<void> {

        const connection = await sql.reserve()

        try {
            const [existingReview] = await connection`SELECT * FROM reviews WHERE id = ${id}`;

            if(!existingReview) {
                throw new InvalidCredentialsError();
            }

            await connection`DELETE FROM reviews WHERE id = ${id}`;

        } catch (error) {
            throw error
        }

        await connection.release()
    }

    static async findBySongId(sql: postgres.Sql<any>, songId: number): Promise<Review[]> {
        const connection = await sql.reserve();
        try {
            const rows = await connection`SELECT * FROM reviews WHERE song_id = ${songId}`;
            return rows.map(row => new Review(sql, convertToCase(snakeToCamel, row) as ReviewProps));
        } catch (error) {
            throw error;
        } finally {
            await connection.release();
        }
    }

}
