let favorites = JSON.parse(localStorage.getItem('musicFavorites')) || [];
let isShowingFavorites = false;
let currentSearchResults = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Main DOM loaded');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const resultsDiv = document.getElementById('results');
    const favoritesBtn = document.getElementById('favorites-btn');
    const audioPlayer = document.getElementById('audio-player');

    console.log('Search elements:', { searchInput, searchButton, resultsDiv });

    searchButton.addEventListener('click', searchMusic);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchMusic();
        }
    });

    const titleElement = document.getElementById('title');
    titleElement.style.cursor = 'pointer';
    titleElement.addEventListener('click', () => {
        window.location.reload(); // Go back to initial state
    });

    // Show favorites on initial load
    updateFavoritesDisplay();

    async function searchMusic() {
        const query = searchInput.value.trim();
        if (!query) return;

        try {
            const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            currentSearchResults = data.results || [];
            displayResults(currentSearchResults);
            updateFavoritesDisplay();
        } catch (error) {
            console.error('Error searching music:', error);
            resultsDiv.innerHTML = '<p>Error searching for music. Please try again.</p>';
        }
    }

    function displayResults(songs) {
        resultsDiv.innerHTML = '';

        if (songs.length === 0) {
            resultsDiv.innerHTML = '<p>No results found.</p>';
            return;
        }

        songs.forEach(song => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';

            const isFavorite = favorites.some(fav => fav.id === song.id);

            songItem.innerHTML = `
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-actions">
                    <button class="favorite-btn ${isFavorite ? 'favorited' : ''}" data-id="${song.id}" data-title="${song.title}" data-artist="${song.artist}" data-thumbnail="${song.thumbnail}">
                        ${isFavorite ? '✓' : '☐'}
                    </button>
                    <button class="play-button" data-id="${song.id}" data-title="${song.title}" data-artist="${song.artist}" data-thumbnail="${song.thumbnail}">Play Song</button>
                </div>
            `;

            songItem.querySelector('.favorite-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(e.target.dataset);
            });

            songItem.querySelector('.play-button').addEventListener('click', (e) => {
                e.stopPropagation();
                const button = e.target;
                playSong(button.dataset.id, button.dataset.title, button.dataset.artist, button.dataset.thumbnail);
            });

            resultsDiv.appendChild(songItem);
        });
    }

    function toggleFavorite(songData) {
        const songId = songData.id;
        const existingIndex = favorites.findIndex(fav => fav.id === songId);

        if (existingIndex > -1) {
            favorites.splice(existingIndex, 1);
        } else {
            favorites.push(songData);
        }

        localStorage.setItem('musicFavorites', JSON.stringify(favorites));
        if (!isShowingFavorites) {
            displayResults(currentSearchResults);
            updateFavoritesDisplay();
        } else {
            displayResults(favorites);
        }
    }

    // Show favorites under search results when there are favorites
    function updateFavoritesDisplay() {
        if (favorites.length > 0 && !isShowingFavorites) {
            const favoritesSection = document.createElement('div');
            favoritesSection.id = 'favorites-section';
            favoritesSection.innerHTML = '<h3>Your Liked Songs</h3>';

            const favoritesList = document.createElement('div');
            favoritesList.className = 'favorites-list';

            favorites.forEach(song => {
                const songItem = document.createElement('div');
                songItem.className = 'song-item favorite-item';
                songItem.innerHTML = `
                    <div class="song-info">
                        <div class="song-title">${song.title}</div>
                        <div class="song-artist">${song.artist}</div>
                    </div>
                    <button class="play-button" data-id="${song.id}" data-title="${song.title}" data-artist="${song.artist}" data-thumbnail="${song.thumbnail}">Play Song</button>
                `;

                songItem.querySelector('.play-button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const button = e.target;
                    playSong(button.dataset.id, button.dataset.title, button.dataset.artist, button.dataset.thumbnail);
                });

                favoritesList.appendChild(songItem);
            });

            favoritesSection.appendChild(favoritesList);

            // Remove existing favorites section if it exists
            const existingFavorites = document.getElementById('favorites-section');
            if (existingFavorites) {
                existingFavorites.remove();
            }

            resultsDiv.appendChild(favoritesSection);
        } else {
            const existingFavorites = document.getElementById('favorites-section');
            if (existingFavorites) {
                existingFavorites.remove();
            }
        }
    }

    let currentVideoId = null;
    let player = null;

    function playSong(videoId, title, artist, thumbnail) {
        currentVideoId = videoId;

        // Update now playing info
        document.getElementById('current-song-title').textContent = title;
        document.getElementById('current-artist').textContent = artist;
        const albumArt = document.getElementById('current-album-art');
        if (thumbnail) {
            albumArt.src = thumbnail;
            albumArt.style.display = 'block';
        } else {
            albumArt.style.display = 'none';
        }

        // Load YouTube IFrame Player API if not loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = createPlayer;
        } else if (player) {
            player.loadVideoById(videoId);
        } else {
            createPlayer();
        }
    }

    function createPlayer() {
        player = new YT.Player('youtube-player', {
            height: '0',
            width: '0',
            videoId: currentVideoId,
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });

        // Start progress update interval
        setInterval(updateProgress, 1000);
    }

    function onPlayerReady(event) {
        event.target.playVideo();
        updatePlayPauseButton();
    }

    function onPlayerStateChange(event) {
        updatePlayPauseButton();
        if (event.data === YT.PlayerState.ENDED && isRepeating) {
            player.playVideo();
        }
    }

    function updateProgress() {
        if (player && player.getCurrentTime && player.getDuration) {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();

            if (duration > 0) {
                const progressBar = document.getElementById('progress-bar');
                const currentTimeEl = document.getElementById('current-time');
                const durationEl = document.getElementById('duration');

                progressBar.value = (currentTime / duration) * 100;
                currentTimeEl.textContent = formatTime(currentTime);
                durationEl.textContent = formatTime(duration);
            }
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function seekTo(event) {
        if (player && player.getDuration) {
            const progressBar = event.target;
            const seekTime = (progressBar.value / 100) * player.getDuration();
            player.seekTo(seekTime);
        }
    }

    // Make sure buttons are properly bound
    setTimeout(() => {
        console.log('Binding events after timeout');
        const playPauseBtn = document.getElementById('play-pause-btn');
        const repeatBtn = document.getElementById('repeat-btn');
        const progressBar = document.getElementById('progress-bar');

        console.log('Elements found:', { playPauseBtn, repeatBtn, progressBar });

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', (e) => {
                console.log('Play/pause button clicked');
                e.preventDefault();
                togglePlayPause();
            });
        }
        if (repeatBtn) {
            repeatBtn.addEventListener('click', (e) => {
                console.log('Repeat button clicked');
                e.preventDefault();
                toggleRepeat();
            });
        }
        if (progressBar) {
            progressBar.addEventListener('input', (e) => {
                console.log('Progress bar input');
                seekTo(e);
            });
        }
    }, 1000);

    function updatePlayPauseButton() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const svg = playPauseBtn.querySelector('svg');
        if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
            // Pause icon
            svg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        } else {
            // Play icon
            svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
    }

    function togglePlayPause() {
        console.log('Toggle play/pause clicked');
        if (player) {
            console.log('Player state:', player.getPlayerState());
            if (player.getPlayerState() === YT.PlayerState.PLAYING) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
        } else {
            console.log('No player available');
        }
    }

    let isRepeating = false;

    function toggleRepeat() {
        console.log('Toggle repeat clicked');
        isRepeating = !isRepeating;
        console.log('Repeat state:', isRepeating);
        const repeatBtn = document.getElementById('repeat-btn');
        const svg = repeatBtn.querySelector('svg');
        if (isRepeating) {
            svg.innerHTML = '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><circle cx="12" cy="12" r="2" fill="currentColor"/>';
        } else {
            svg.innerHTML = '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>';
        }
    }
});
