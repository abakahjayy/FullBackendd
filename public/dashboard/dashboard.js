document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);

    // Google OAuth (see login.js/signup.js) lands here with ?token=<jwt> -
    // that's already a valid, self-contained token, so skip the legacy
    // cookie-lookup flow below entirely for that case.
    let token = urlParams.get("token");
    let userId = urlParams.get("id") || localStorage.getItem("userId") || sessionStorage.getItem("userId");

    if (!token) {
        const userTok = urlParams.get("oven");
        const response = await fetch("/api/v1/auth/userId", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, userTok }),
        });
        const datas = await response.json();
        token = datas.cookie ? datas.cookie.token : datas.userTok;
    } else if (!userId) {
        // JWT payload is base64url-encoded JSON in the middle segment -
        // decode it locally instead of a round-trip just to learn our own id.
        try {
            userId = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).userId;
        } catch {
            // Not fatal - userId is only used to namespace cached localStorage keys below.
        }
    }

    if (!token) {
        window.location.href = "../login/login.html"; // Redirect if not logged in
        return;
    }

    if (userId) {
        localStorage.setItem(`token-${userId}`, token);
        localStorage.setItem("userId", userId);
    }

    const FetchImage=async()=>{
        try {
            const profilePictureId=localStorage.getItem(`profileId-${userId}`);
            const response= await fetch(`/api/v1/uploadFiles/download/${profilePictureId}`)

            // Create a blob from the response
            const blob = await response.blob();

            // Create an object URL for the image to display it
            const imageURL = URL.createObjectURL(blob);
            console.log(imageURL);
                    // if (data.success) {
            document.getElementById("upload-statuss").innerText = "Profile picture loaded successfully.";
            document.getElementById("profile-pic").src = imageURL;
        }catch{
                document.getElementById("upload-statuss").innerText ="Failed to load image.";
        }
        setTimeout(()=>{
            document.getElementById("upload-statuss").innerText = ""
        },2000)
    }
    // Fetch user details
    await fetch('/api/v1/auth/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.error) {
                alert(data.error);
                window.location.href = "../login/login.html";
            } else {
                // console.log(data.user)
                // Display user details
                //It is advisable not to add the password to the user details
                const { username, email, profile_picture} = data.user;

                // Display username and email
                document.getElementById("user-name").innerText = username;
                document.getElementById("user-details").innerText = `Email: ${email}\nUsername: ${username}`;

                // Display profile picture (if available)
                if(profile_picture){
                    document.getElementById("profile-pic").src = profile_picture
                }else{
                    FetchImage();
                }
                // localStorage.removeItem(`token-${userId}`);
                // localStorage.removeItem("userId");
                // token=data.token;
                // localStorage.setItem(`userId-${data.user._id}`,data.user._id);
                // localStorage.setItem(`token-${userId}`,data.token);

            }
        })
        .catch(() => alert("Failed to load user details."));
        // localStorage.removeItem(`token-${userId}`);
        // localStorage.removeItem("userId");

    // Logout
    document.getElementById("logout").addEventListener("click", () => {
        localStorage.removeItem(`token-${userId}`);
        localStorage.removeItem("userId");
        localStorage.removeItem(`datas-${userId}`);
        window.location.href = "../login/login.html";
    });

    // Image Upload Functionality
    document.getElementById("upload-btn").addEventListener("click", async () => {
        //Common syntax for the file input level
        const fileInput = document.getElementById("file-input");
        const file = fileInput.files[0];



        // const imageFile = e.target.files[0];

        if (!file) {
            document.getElementById("upload-status").innerText = "Please select an image to upload.";
            return;
        }

        const formData = new FormData();
        formData.append("profile_picture", file);
        console.log(formData.get("profile_picture"));

        // Upload the image
        await fetch("/api/v1/auth/upload-profile-pic", {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData,
            })
            .then((res) => res.json())
            .then((data) => {
                console.log(data);
                if (data.success) {
                    document.getElementById("upload-status").innerText = "Profile picture uploaded successfully.";
                    document.getElementById("profile-pic").src = data.profile_picture;
                } else {
                    document.getElementById("upload-status").innerText = data.error || "Failed to upload image.";
                }
            })
            .catch((err) => {
                document.getElementById("upload-status").innerText ="Error uploading image.";
            });
            setTimeout(()=>{
                document.getElementById("upload-status").innerText = ""
            },2000)
    });




    document.getElementById("upload-btns").addEventListener("click", async () => {
        //Common syntax for the file input level
        const fileInput = document.getElementById("file-inputs");
        const file = fileInput.files[0];



        // const imageFile = e.target.files[0];

        if (!file) {
            document.getElementById("upload-statuss").innerText = "Please select an image to upload.";
            return;
        }

        const formDatas = new FormData();
        formDatas.append("profile_pictures", file);
        console.log(formDatas.get("profile_pictures"));

        // Upload the image
        await fetch("/api/v1/uploadFiles/upload-profile-pic", {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formDatas,
            })
            .then((res) => res.json())
            .then((data) => {
                console.log(data);
                localStorage.setItem(`profileId-${userId}`, data.fileId);
                if (data.success) {
                    document.getElementById("upload-statuss").innerText = "Profile picture uploaded successfully.";
                    FetchImage()
                } else {
                    document.getElementById("upload-statuss").innerText = data.error || "Failed to upload image.";
                }
            })
            .catch((err) => {
                document.getElementById("upload-statuss").innerText ="Error uploading image.";
            });
            setTimeout(()=>{
                document.getElementById("upload-statuss").innerText = ""
            },2000)

            
            
    });
});
