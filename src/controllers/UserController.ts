import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import User, {UserProps} from "../models/User";

export default class UserController {
    private sql: postgres.Sql<any>;

    constructor(sql: postgres.Sql<any>) {
        this.sql = sql;
    }

    registerRoutes(router: Router) {
        router.get("/account", this.showAccount);
        router.post("/users", this.createUser)
    }

    createUser = async (req: Request, res: Response) => {
        const { username, email, password, confirmPassword } = req.body;
    
        if (!password) {
          await res.send({
            statusCode: StatusCode.BadRequest,
            message: "Missing password.",
            redirect: "/register?error=Password required",
          });
          return;
        } else if (!email) {
          await res.send({
            statusCode: StatusCode.BadRequest,
            message: "Missing email.",
            redirect: "/register?error=Email is required",
          });
          return;
        } else if (password !== confirmPassword) {
          await res.send({
            statusCode: StatusCode.BadRequest,
            message: "Passwords do not match",
            redirect: "/register?error=Passwords do not match",
          });
          return;
        }
    
        try {
          await User.checkEmailDuplication(this.sql, req.body as UserProps);
          let props: UserProps = {
            username,
            email,
            password,
          };
          const user = await User.create(this.sql, props);
          await res.send({
            statusCode: StatusCode.Created,
            message: "User created",
            payload: {
              user: user.props,
            },
            redirect: "/login",
          });
        } catch (error) {
          await res.send({
            statusCode: StatusCode.BadRequest,
            message: "User with this email already exists.",
            redirect: "/register?error=duplicate_email",
          });
        }
      };


    showAccount = async (req: Request, res: Response) => {
        const userId = req.session.get('userId');
        if (!userId) {
            await res.send({
                statusCode: StatusCode.Unauthorized,
                redirect: "/login",
                message: "Please log in to view your account"
            });
            return;
        }
        try {
            const user = await User.findById(this.sql, userId);
            if (!user) {
                await res.send({
                    statusCode: StatusCode.NotFound,
                    message: "User not found"
                });
                return;
            }

            await res.send({
                statusCode: StatusCode.OK,
                message: "Account Details",
                template: "AccountView",
                payload: { user: user.props, loggedIn: true }
            });
        } catch (error) {
            await res.send({
                statusCode: StatusCode.InternalServerError,
                message: "Error retrieving account details"
            });
        }
    };

    
}
