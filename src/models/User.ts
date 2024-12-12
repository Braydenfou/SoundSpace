import postgres from "postgres";
import { REPL_MODE_SLOPPY } from "repl";
import {
  camelToSnake,
  convertToCase,
  createUTCDate,
  snakeToCamel,
} from "../utils";

export interface UserProps {
  id?: number;
  username: string;
  email: string;
  password: string;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("User with this email already exists.");
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials.");
  }
}

export default class User {
  constructor(
    private sql: postgres.Sql<any>,
    public props: UserProps
  ) {}

  /**
   * TODO: Implement this method. It should insert a new
   * row into the "users" table with the provided props.
   */
  static async create(sql: postgres.Sql<any>, props: UserProps): Promise<User> {
    const connection = await sql.reserve();
    try {

      // Check for existing user
      const [existingUser] = await connection`SELECT * FROM users WHERE email = ${props.email}`;
      if (existingUser) {
        throw new DuplicateEmailError();
      }
      
      const [row] = await connection`INSERT INTO users (email, password, username) VALUES (${props.email}, ${props.password}, ${props.username}) RETURNING *`;
      return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
      
    } catch(error) {
      throw error;
    }
    await connection.release();
  }

  /**
   * TODO: To "log in" a user, we need to check if the
   * provided email and password match an existing row
   * in the database. If they do, we return a new User instance.
   */
  static async login(
    sql: postgres.Sql<any>,
    email: string,
    password: string
  ): Promise<User | null> {
    const connection = await sql.reserve();

    const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;

    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (user.password !== password) {
      throw new InvalidCredentialsError();
    }

    await connection.release();
    
    return new User(sql, {
      id: user.id,
      username: user.username,
      email: user.email,
      password: user.password,
    });
  }

  static async findById(sql: postgres.Sql<any>, id: number): Promise<User> {
    const connection = await sql.reserve();
    try {
      const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;

      if (row) {
        return new User(sql, convertToCase(snakeToCamel, row) as UserProps);
      } else {
        throw new Error("Error could not locate user");
      }
    } catch (error) {
      await connection.release();
      throw error;
    }
    await connection.release();
  }

  static async checkEmailDuplication(
    sql: postgres.Sql<any>,
    props: UserProps | Partial<UserProps>,
  ) {
    const [existingUser] = await sql`
    SELECT * FROM
    users WHERE email = ${props.email}`;

    if (existingUser) {
      throw new DuplicateEmailError();
    }
  }
}