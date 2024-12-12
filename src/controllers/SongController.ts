import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Song from "../models/Song";
import Rating from "../models/Rating";

export default class SongController {
    private sql: postgres.Sql<any>;

    constructor(sql: postgres.Sql<any>) {
        this.sql = sql;
    }

    registerRoutes(router: Router) {
        router.get("/songs/:id", this.getSong);
        router.post("/songs/search", this.searchSongs);
        router.post("/songs/:id/rate", this.addRating);
    }

    getSong = async (req: Request, res: Response) => {
        const id = req.getId();
        try {
            const song = await Song.findById(this.sql, id.toString());
            if (!song) {
                await res.send({
                    statusCode: StatusCode.NotFound,
                    message: "Song not found"
                });
                return;
            }
            const ratings = await Rating.findBySongId(this.sql, id);
            let sum = 0;
            for (const rating of ratings) {
                sum += rating.props.rating;
            }

            let avgRating = 0;
            if (ratings.length > 0) {
                avgRating = sum / ratings.length;
            }
            const avgRatingFormatted = avgRating.toFixed(2);

            await res.send({
                statusCode: StatusCode.OK,
                message: "Song Details",
                template: "SongDetailView",
                payload: {
                    song: song.props,
                    avgRating: avgRatingFormatted,
                    ratings: ratings.map((rating: Rating) => rating.props),
                    loggedIn: !!req.session.data.userId
                }
            });
        } catch (error) {
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: "Error retrieving song"
            });
        }
    };

    searchSongs = async (req: Request, res: Response) => {
        const { query } = req.body

        if (!query) {
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: "Query parameter is missing"
            });
            return;
        }

        try {
            const song = await Song.search(this.sql, query);
            if (song) {
                await res.send({
                    statusCode: StatusCode.OK,
                    message: "Search Results",
                    template: "SongDetailView",
                    payload: { song: song.props }
                });
            } else {
                await res.send({
                    statusCode: StatusCode.NotFound,
                    message: "No song found matching the query",
                    template: "ErrorView",
                    payload: { message: "No song found from the search",  loggedIn: !!req.session.data.userId }
                });
            }
        } catch (error) {
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: "Error searching for songs"
            });
        }
    };

    addRating = async (req: Request, res: Response) => {
        const songId = req.getId();
        const { rating } = req.body;

        if (!req.session.data.userId) {
            await res.send({
                statusCode: StatusCode.Unauthorized,
                redirect: "/login",
                message: "Please log in to rate the song"
            });
            return;
        }

        try {
            await Rating.create(this.sql, { userId: req.session.data.userId, songId, rating });
            await res.send({
                statusCode: StatusCode.Created,
                redirect: `/songs/${songId}`,
                message: "Rating added successfully"
            });
        } catch (error) {
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: "Error adding rating"
            });
        }
    };
}
