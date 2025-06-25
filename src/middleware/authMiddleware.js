const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')
dotenv.config();
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "No token provided",
            status: "ERROR",
        });
    }
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, user) {
        if (err) {
            return res.status(403).json({
                message: "The authentication",
                status: "ERROR",
            });
        }

        req.user = user;

        if (user?.isAdmin) {
            next();
        } else {
            return res.status(404).json({
                message: 'The authentication',
                status: 'ERROR'
            })
        }
    })
}

const authUserMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "No token provided",
            status: "ERROR",
        });
    }
    const token = authHeader.split(" ")[1];
    const userId = req.params.id;

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, user) {
        if (err) {
            return res.status(404).json({
                message: "The ạicaiwjaiddnwi",
                status: "ERROR",
            });
        }
        const { payload } = user
        if (user?.isAdmin || user?.id === userId) {
            next();
        } else {
            return res.status(404).json({
                message: 'The adsasdasdsadsadsadasdsadsad',
                status: 'ERROR'
            })
        }
    })
}
const authUserV2Middleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "No token provided",
            status: "ERROR",
        });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, user) {
        if (err) {
            return res.status(404).json({
                message: err.message,
                status: "ERROR",
            });
        }
        req.user = user
        if (!user?.isAdmin) {
            next();
        } else {
            return res.status(404).json({
                message: 'The adsasdasdsadsadsadasdsadsad',
                status: 'ERROR'
            })
        }
    })
}
module.exports = {
    authMiddleware,
    authUserMiddleware,
    authUserV2Middleware
}