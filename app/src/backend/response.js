export default (response = {
	error: (res, code, err_msg) =>
		res.status(code).json({
			status: code,
			error: err_msg,
		}),
	success: (res, body) => res.status(200).json({ status: 200, body }),
})
