const url = 'https://script.google.com/macros/s/AKfycbwzSzAxX6tgXtVDt_U7PQFnXq5eupYTgBSEJ9VV7WOjY_I2tazX3wv-gYFOVLkxNSrW/exec';
fetch(url)
    .then(r => r.json())
    .then(data => {
        if(data && data.data) {
            console.log(JSON.stringify(data.data.slice(0, 5), null, 2));
        } else {
            console.log(data);
        }
    })
    .catch(err => console.error(err));
