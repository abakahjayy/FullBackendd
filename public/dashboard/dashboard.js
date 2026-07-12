// import Cookie from '../../node_modules/js-cookie';
document.addEventListener("DOMContentLoaded", async () => {
    // Regular Colors
console.log('\x1b[31m%s\x1b[0m', 'This is red');       // Red text
console.log('\x1b[32m%s\x1b[0m', 'This is green');     // Green text
console.log('\x1b[33m%s\x1b[0m', 'This is yellow');    // Yellow text
console.log('\x1b[34m%s\x1b[0m', 'This is blue');      // Blue text
console.log('\x1b[35m%s\x1b[0m', 'This is magenta');   // Magenta text
console.log('\x1b[36m%s\x1b[0m', 'This is cyan');      // Cyan text
console.log('\x1b[37m%s\x1b[0m', 'This is white');     // White text

// Background Colors
console.log('\x1b[41m%s\x1b[0m', 'This has red background'); // Red background
console.log('\x1b[42m%s\x1b[0m', 'This has green background'); // Green background

// Bold and Underline
console.log('\x1b[1m%s\x1b[0m', 'This is bold');        // Bold text
console.log('\x1b[4m%s\x1b[0m', 'This is underlined');  // Underlined text

// Reset Style
console.log('\x1b[0m%s\x1b[0m', 'This is normal again'); // Reset style
    const urlParams = new URLSearchParams(window.location.search);
    const userId =urlParams.get("id")|| localStorage.getItem("userId") || sessionStorage.getItem("userId");
    const userTok =urlParams.get("oven")
    // console.log(userId);
    
    const response = await fetch("/api/v1/auth/userId", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId,userTok}),
    });

    let datas = await response.json();
    // console.log(datas);
    
    let token = datas.cookie?datas.cookie.token : datas.userTok;
    // console.log(token);
    // console.log(userId);
    if (!token) {
        window.location.href = "../login/login.html"; // Redirect if not logged in
        return;
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
