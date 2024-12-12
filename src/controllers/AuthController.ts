import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Cookie from "../auth/Cookie";
import User, { InvalidCredentialsError } from "../models/User";
import Session from "../auth/Session";
import UserController from "./UserController";

export default class AuthController {
	private sql: postgres.Sql<any>;
	private userController: UserController;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
		this.userController = new UserController(sql);
	}

	registerRoutes(router: Router) {
		router.get("/register", this.getRegistrationForm);
		router.get("/login", this.getLoginForm);
		router.post("/login", this.login);
		router.post("/register", this.userController.createUser);
		router.get("/logout", this.logout);
	}

	/**
	 * TODO: Render the registration form.
	 */
	getRegistrationForm = async (req: Request, res: Response) => {
		await res.send({
			statusCode: StatusCode.OK,
			message: "Registration Form",
			template: "RegistrationFormView",
			payload: {title: "Registration", errorMessage: req.getSearchParams().get("error"),
			loggedIn: !!req.session.data.userId}
		});
	};

	/**
	 * TODO: Render the login form.
	 */
	getLoginForm = async (req: Request, res: Response) => {
		const sessionCookie = new Cookie('session_id', req.session.id);
		res.setCookie(sessionCookie);
		req.session.cookie = sessionCookie;
		const emailCookie = req.cookies.find((cookie) => cookie.name === 'email');
		const email = emailCookie ? emailCookie.value : '';

		let message;
		if (req.getSearchParams().get("error") === "Email is required") {
			message = "Email is Required."
		}
		else if (req.getSearchParams().get("error") == "Invalid Credentials") {
			message = "Invalid Credentials."
		}
		await res.send({
			statusCode: StatusCode.OK,
			message: "Login Form",
			template: "LoginFormView",
			payload: {title: "Login", errorMessage: req.getSearchParams().get("error"), rememberEmail: email,
		}
		});
	};

	/**
	 * TODO: Handle registration form submission.
	 */
    // register = async (req: Request, res: Response) => {
	// 	console.log('Register endpoint hit');
    //     await req.parseBody();
	// 	console.log("Parsed request body:", req.body);
	// 	const { username, email, password, confirmPassword } = req.body;
	// 	console.log("Request body fields:", { username, email, password, confirmPassword });

    //     if (password !== confirmPassword) {
    //         await res.send({
    //             statusCode: StatusCode.BadRequest,
    //             redirect: "/register?error=Passwords do not match",
    //             message: "Passwords do not match"
    //         });
	// 		console.log("Passwords do not match");
    //         return;
    //     }
    //     try {
	// 		console.log("Attempting to create user");
	// 		await User.create(this.sql, { username, email, password});
	// 		console.log("User created successfully");
    //         await res.send({
    //             statusCode: StatusCode.Created,
    //             redirect: "/login",
    //             message: "User registered successfully"
    //         });
    //     } catch (error) {
	// 		console.log("Error creating user:", error);
    //         await res.send({
    //             statusCode: StatusCode.BadRequest,
    //             redirect: "/register?error=Email already exists",
    //             message: "Email already exists"
    //         });
    //     }
    // };
	/**
	 * TODO: Handle login form submission.
	 */
	login = async (req: Request, res: Response) => {
		const { email, password, rememberMe } = req.body;
		try {
	  
		  // Validate the input
		  if (!email || !password) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				redirect: "/login?error=Email is required",
				message: "Email required",
			})
		  }
		  const user = await User.login(this.sql, email, password);
		  if(!user) {
			return null
		  }
		  req.session.set('userId', user.props.id);
		  const sessionCookie = new Cookie("session_id", req.session.id);
		  res.setCookie(sessionCookie)
		  if (rememberMe){
			const rememberEmailCookie = new Cookie('email', user.props.email);
			res.setCookie(rememberEmailCookie); 
		  }

		  await res.send({
			statusCode: StatusCode.OK,
			redirect: '/',
			message: "Logged in successfully!",
			payload: { user: user.props, loggedIn: true },
		  });
		} catch (error) {
		  res.send({
			statusCode: StatusCode.BadRequest,
			redirect: `/login?error=Invalid credentials`,
			message: "Invalid credentials.",
			
		  });
		}
	  };
	  

	/**
	 * TODO: Handle logout.
	 */

	logout = async (req: Request, res: Response) => {
		req.session.destroy();
		req.session.isExpired();
		const clearSessionCookie = new Cookie('session_id', '', -1);
		res.setCookie(clearSessionCookie);
		res.send({
			statusCode: StatusCode.OK,
			redirect: '/',  
			message: "Logout successful",
			payload: {loggedIn: false},
		});
	};
}