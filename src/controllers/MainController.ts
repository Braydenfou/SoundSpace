// import postgres from "postgres";
// import Router from "../router/Router";
// import Request from "../router/Request";
// import Response, { StatusCode } from "../router/Response";
// import Song from "../models/Song";
// import { time } from "console";
// import { title } from "process";

// export default class MainController {
//     private sql: postgres.Sql<any>;

//     constructor(sql: postgres.Sql<any>) {
//         this.sql = sql;
//     }

//     registerRoutes(router: Router) {
//         router.post("/", this.home);
//     }

//     home = async (req: Request, res: Response) => {
//         // console.log("Home route accessed"); // Added logging
//         try {
//             const topSongs = await Song.getTopSongs(this.sql);
//             const songList = topSongs.map((song) => ({
//                 ...song.props,
//             }));

//             console.log("Top songs retrieved:", songList); // Added logging
//             await res.send({
//                 statusCode: StatusCode.OK,
//                 message: "Top songs retrieved",
//                 payload: {
//                     title: "Top Song List",
//                     topSongs: songList,
//                 },
//                 template: "HomeView",
//             });
//         } catch (error) {
//             console.error("Error retrieving top songs:", error); // Added logging
//             await res.send({
//                 statusCode: StatusCode.InternalServerError,
//                 message: 'Internal Server Error',
//                 template: 'ErrorView',
//                 payload: { error: 'Internal Server Error' }
//             });
//         }
//     };
// }