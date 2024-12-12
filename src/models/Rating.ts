import postgres from "postgres";
import {
    camelToSnake,
    convertToCase,
    snakeToCamel,
} from "../utils";
import { InvalidCredentialsError } from "./User";


export interface RatingProps {
    id?: number,
    userId: number,
    songId: number,
    rating: number
}

export default class Rating {
    constructor(
        private sql: postgres.Sql<any>,
        public props: RatingProps
    ) {}


    static async create(sql: postgres.Sql<any>, props: RatingProps): Promise<Rating> {
        const connection = await sql.reserve()

        try {
            const [rating] = await connection`INSERT INTO ratings (user_id, song_id, rating)
            VALUES (${props.userId}, ${props.songId}, ${props.rating})
            RETURNING *`;

            return new Rating(sql, convertToCase(snakeToCamel, rating) as RatingProps)

            
        } catch (error) {
            throw error
        }
        
        await connection.release()
    }


    static async delete(sql: postgres.Sql<any>, id: number): Promise<void> {
        const connection = await sql.reserve()
        
        if(!Number.isInteger(id) || id <= 0) {
            throw new InvalidCredentialsError()
        }

        try{
            //validate that a user exists based on its user id
            const [rating] = await connection`SELECT * FROM ratings WHERE id = ${id}`;

            if (!rating) {
                throw new InvalidCredentialsError()
            }

            await connection`DELETE FROM ratings WHERE id = ${id}`;
        } catch (error) {
            throw error
        }

        await connection.release()
    }
    static async findBySongId(sql: postgres.Sql<any>, songId: number): Promise<Rating[]> {
        const connection = await sql.reserve()

        try {
            const rows = await connection`SELECT * FROM ratings WHERE song_id = ${songId}`;
        return rows.map(row => new Rating(sql, convertToCase(snakeToCamel, row) as RatingProps));
        } catch (error) {
            throw error
        } finally {
            await connection.release()
        }
    }
}


