const playlistEl = document.getElementById('playlist')
const currentSongEl = document.getElementById('current-song')
const currentArtistEl = document.getElementById('current-artist')
const timelineEl = document.getElementById('timeline')
const currentTimeEl = document.getElementById('current-time')
const durationEl = document.getElementById('duration')
const playBtn = document.getElementById('play')
const nextBtn = document.getElementById('next')
const prevBtn = document.getElementById('prev')
const volumeEl = document.getElementById('volume')
const youtubeLink = document.getElementById('youtube-link')
const spotifyLink = document.getElementById('spotify-link')

let songs = []
let currentIndex = 0
let audio = new Audio()
let currentRating = -1

fetch('songs/songs.json')
    .then(r => r.json())
    .then(data => {
        songs = data.sort((a, b) => a.title.localeCompare(b.title));
        renderPlaylist();
        handleUrlSongSelect();
    });

function getQueryParams() {
    const params = {};
    window.location.search.replace(/[?&]([^=#]+)=([^&#]*)/g, (m, k, v) => params[k] = decodeURIComponent(v));
    return params;
}

function normalizeString(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
    const an = a.length, bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = [];
    for (let i = 0; i <= bn; ++i) matrix[i] = [i];
    for (let j = 0; j <= an; ++j) matrix[0][j] = j;
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[bn][an];
}

function handleUrlSongSelect() {
    const params = getQueryParams();
    if (songs.length === 0) return;
    let loadedFromUrl = false;
    let urlVolume = null;
    let urlTime = null;
    if (params.volume !== undefined) {
        let v = params.volume.trim();
        if (v.endsWith('%')) v = v.slice(0, -1);
        v = parseFloat(v);
        if (!isNaN(v)) {
            urlVolume = v > 1 ? v / 100 : v;
            urlVolume = Math.max(0, Math.min(1, urlVolume));
        }
    }
    if (params.time !== undefined) {
        urlTime = params.time.trim();
    }
    let songIdx = -1;
    if (params.file) {
        let file = params.file.toLowerCase();
        if (!file.endsWith('.opus')) file += '.opus';
        const idx = songs.findIndex(s => s.file.toLowerCase() === file);
        if (idx !== -1) {
            songIdx = idx;
            loadedFromUrl = true;
        }
    }
    if (!loadedFromUrl && params.song) {
        const target = normalizeString(params.song);
        let minDist = Infinity, minIdx = -1;
        songs.forEach((s, i) => {
            const dist = levenshtein(normalizeString(s.title), target);
            if (dist < minDist) {
                minDist = dist;
                minIdx = i;
            }
        });
        if (minIdx !== -1) {
            songIdx = minIdx;
            currentRating = songs[minIdx].rating !== undefined ? songs[minIdx].rating : -1;
            loadedFromUrl = true;
        }
    }
    if (loadedFromUrl && songIdx !== -1) {
        loadSong(songIdx, false, urlVolume, urlTime);
        audio.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else if (urlVolume !== null || urlTime !== null) {
        if (urlVolume !== null) {
            audio.volume = Math.pow(urlVolume, 2);
            volumeEl.value = urlVolume;
        }
        if (urlTime !== null) {
            seekToTime(urlTime);
        }
    }
}

function renderPlaylist() {
    playlistEl.innerHTML = '';
    songs.forEach((song, i) => {
        const li = document.createElement('li');
        li.textContent = song.title;
        li.addEventListener('click', () => {
            loadSong(i, true);
            currentRating = songs[i].rating !== undefined ? songs[i].rating : -1;
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        });
        playlistEl.appendChild(li);
    });
    const countEl = document.getElementById('playlist-count');
    if (countEl) {
        countEl.textContent = `${songs.length}`;
    }
    timelineEl.disabled = true;
    playBtn.disabled = true;
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    playBtn.classList.add('disabled');
    nextBtn.classList.add('disabled');
    prevBtn.classList.add('disabled');
}

function loadSong(index, playOnLoad = false, urlVolume = null, urlTime = null) {
    audio.onloadedmetadata = function () {
        timelineEl.value = 0;
        currentTimeEl.textContent = '0:00';
        durationEl.textContent = formatTime(audio.duration || 0);
        if (urlVolume !== null) {
            audio.volume = Math.pow(urlVolume, 2);
            volumeEl.value = urlVolume;
        }
        if (urlTime !== null) {
            seekToTime(urlTime);
        }
    };
    const song = songs[index];
    currentIndex = index;
    audio.src = `songs/${song.file}`;
    audio.load();
    timelineEl.value = 0;
    currentRating = songs[index].rating !== undefined ? songs[index].rating : -1;
    currentTimeEl.textContent = '0:00';
    if (playOnLoad) {
        audio.play();
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        audio.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    currentSongEl.textContent = song.title;
    currentArtistEl.textContent = song.artist;
    updateActive();
    updateLinks(song);
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    timelineEl.disabled = false;
    playBtn.disabled = false;
    nextBtn.disabled = false;
    prevBtn.disabled = false;
    playBtn.classList.remove('disabled');
    nextBtn.classList.remove('disabled');
    prevBtn.classList.remove('disabled');
    setTimeout(() => retryDuration(0), 100);
    const style = document.createElement('style');
    style.innerHTML = `
.btn-small.disabled,
button:disabled {
    opacity: 0.5;
    pointer-events: none;
    filter: grayscale(0.7) brightness(1.2);
}`;
    document.head.appendChild(style);
}

function seekToTime(timeStr) {
    let duration = audio.duration;
    if (!isFinite(duration) || isNaN(duration) || duration <= 0) return;
    let t = 0;
    if (typeof timeStr !== 'string') timeStr = String(timeStr);
    timeStr = timeStr.trim();
    if (timeStr.startsWith('-')) {
        let abs = timeStr.slice(1);
        t = parseTimeString(abs);
        t = Math.max(0, duration - t);
    } else {
        t = parseTimeString(timeStr);
        t = Math.max(0, Math.min(duration, t));
    }
    audio.currentTime = t;
}

function parseTimeString(str) {
    if (str.includes(':')) {
        let parts = str.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    }
    let n = Number(str);
    if (!isNaN(n)) return n;
    return 0;
}

function updateActive() {
    Array.from(playlistEl.children).forEach((li, i) => {
        li.classList.toggle('active', i === currentIndex)
    })
}

function updateLinks(song) {
    if (song.youtube && song.youtube !== '#') {
        youtubeLink.setAttribute('href', song.youtube);
    } else {
        youtubeLink.setAttribute('href', '#');
    }
    if (song.spotify && song.spotify !== '#') {
        spotifyLink.setAttribute('href', song.spotify);
    } else {
        spotifyLink.setAttribute('href', '#');
    }
}

playBtn.addEventListener('click', () => {
    if (audio.paused) {
        audio.play()
        playBtn.innerHTML = '<i class="fas fa-pause"></i>'
    } else {
        audio.pause()
        playBtn.innerHTML = '<i class="fas fa-play"></i>'
    }
})

nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % songs.length
    loadSong(currentIndex)
})

prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + songs.length) % songs.length
    loadSong(currentIndex)
})

audio.addEventListener('timeupdate', () => {
    const current = audio.currentTime;
    let duration = audio.duration || 0;
    if (!isFinite(duration) || isNaN(duration) || duration <= 1) {
        retryDuration();
    } else {
        timelineEl.value = duration ? (current / duration) * 100 : 0;
        currentTimeEl.textContent = formatTime(current);
        durationEl.textContent = formatTime(duration);
    }
});

audio.addEventListener('ended', () => {
    currentIndex = (currentIndex + 1) % songs.length;
    loadSong(currentIndex);
    audio.play();
    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
});

function retryDuration(retries = 0) {
    if (retries > 10) return;
    let duration = audio.duration;
    if (!isFinite(duration) || isNaN(duration) || duration <= 1) {
        setTimeout(() => retryDuration(retries + 1), 100);
    } else {
        durationEl.textContent = formatTime(duration);
        timelineEl.value = (audio.currentTime / duration) * 100;
    }
}

timelineEl.addEventListener('input', () => {
    if (timelineEl.disabled) return;
    const duration = audio.duration
    audio.currentTime = (timelineEl.value / 100) * duration
})

volumeEl.addEventListener('input', () => {
    const linear = parseFloat(volumeEl.value);
    audio.volume = Math.pow(linear, 2);
})

function formatTime(sec) {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

const playlistDiv = document.getElementById('playlist');
let playlistHover = false;
playlistDiv.addEventListener('mouseenter', () => { playlistHover = true; });
playlistDiv.addEventListener('mouseleave', () => { playlistHover = false; });

function setupWheel() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (!isMobile) {
        window.addEventListener('wheel', onWheel, { passive: false });
    } else {
        window.removeEventListener('wheel', onWheel);
    }
}

function onWheel(e) {
    if (playlistHover) {
        e.preventDefault();
        playlistDiv.scrollTop += e.deltaY;
    }
}

setupWheel();
window.addEventListener('resize', setupWheel);
