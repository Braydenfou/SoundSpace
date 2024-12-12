import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Review from "../models/Review";
import Song, {SongProps} from "../models/Song";

export default class ReviewController {
    private sql: postgres.Sql<any>;

    constructor(sql: postgres.Sql<any>) {
        this.sql = sql;
    }

    registerRoutes(router: Router) {
        router.post('/songs/:id/review', this.addReview);
        router.delete('/reviews/:id', this.deleteReview);
        router.get('/songs/:id/reviews', this.getReviews);
    }

    addReview = async (req: Request, res: Response) => {
        const songId = req.getId();
        const { content } = req.body;
        const userId = req.session.data.userId;

        if (!userId) {
            await res.send({
                statusCode: StatusCode.Unauthorized,
                redirect: '/login',
                message: 'Please log in to add a review',
            });
            return;
        }

        console.log(`Retrieved songId=${songId}`);
        console.log(`Full URL: ${req.req.url}`);

        if (!songId || songId <= 0) {
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: 'Invalid song ID',
            });
            return;
        }

        try {
            console.log(`Adding review: userId=${userId}, songId=${songId}, content=${content}`);
            const newReview = await Review.create(this.sql, { userId, songId, content });
            await res.send({
                statusCode: StatusCode.Created,
                message: 'Review added successfully',
                payload: { review: newReview.props, loggedIn: !!req.session.data.userId },
                redirect: `/songs/${songId}/reviews`,
            });
        } catch (error) {
            console.error('Error adding review:', error);
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: 'Error adding review',
                payload: { error }
            });
        }
    };

    deleteReview = async (req: Request, res: Response) => {
        const reviewId = req.getId();
        try {
            await Review.delete(this.sql, reviewId);
            await res.send({
                statusCode: StatusCode.OK,
                message: 'Review deleted successfully',
            });
        } catch (error) {
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: 'Error deleting review',
            });
        }
    };

    getReviews = async (req: Request, res: Response) => {
        const songId = req.getId();
        try {
            const reviews = await Review.findBySongId(this.sql, songId);
            const [songData] = await this.sql<SongProps[]>`SELECT * FROM songs WHERE id = ${songId}`;
            if (!songData) {
                await res.send({
                    statusCode: StatusCode.NotFound,
                    message: 'Song not found',
                });
                return;
            }

            const song = new Song(this.sql, songData);
            await res.send({
                statusCode: StatusCode.OK,
                message: 'Song Reviews',
                template: 'ReviewView',
                payload: { 
                    reviews: reviews.map((review: Review) => review.props),
                    song: song.props, // Pass the actual song instance properties
                    loggedIn: !!req.session.data.userId,
                },
            });
        } catch (error) {
            await res.send({
                statusCode: StatusCode.BadRequest,
                message: 'Error retrieving reviews',
            });
        }
    };
}
