
const loginBox = <HTMLDivElement>document.getElementById("login-box");
const loginBtn = <HTMLButtonElement>document.getElementById("login-btn");
const usernameField = <HTMLInputElement>document.getElementById("uname");
const passwordField = <HTMLInputElement>document.getElementById("pass");

loginBtn.addEventListener('click', ev => {
	ev.preventDefault();

	const body = JSON.stringify({
		username: usernameField.value,
		password: passwordField.value
	});

	fetch('/login', {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: body
	})
		.then(response => {
			if (response.status === 401)
				throw new Error("Incorrect password");

			// Save the username and password in local storage (I know this is insecure, but it was my hacky workaround)
			localStorage.setItem("username", usernameField.value);
			localStorage.setItem("password", passwordField.value);
			window.location.replace(response.url);
		})
		.catch(error => {
			// Display incorrect password message
			const errorMSG = <HTMLParagraphElement>document.createElement('p');
			errorMSG.innerText = "Password was incorrect";
			errorMSG.style.color = "red";
			loginBox.appendChild(errorMSG);
		});
});
