let favorites = JSON.parse(localStorage.getItem('musicFavorites')) || [];
let isShowingFavorites = false;
let currentSearchResults = null;
let playlists = JSON.parse(localStorage.getItem('musicPlaylists')) || [];
let selectedPlaylistId = null;
let playlistSongs = JSON.parse(localStorage.getItem('musicPlaylistSongs')) || {};
let playlistMode = null; // 'play' or 'shuffle'
let playlistQueue = [];
let playlistQueueIndex = 0;

window.addEventListener('DOMContentLoaded', () => {
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
    titleElement.addEventListener('click', (e) => {
        e.preventDefault();
        history.pushState({}, '', '/');
        searchInput.value = '';
        resultsDiv.innerHTML = '';
        updateFavoritesDisplay();
        renderPlaylists();
        const playlistsBottom = document.getElementById('playlists-bottom');
        if (playlistsBottom) playlistsBottom.style.display = '';
    });
// Prevent full reload on navigation
window.addEventListener('popstate', () => {
    // Re-render playlists and results
    renderPlaylists();
    updateFavoritesDisplay();
});

    // Show favorites on initial load
    updateFavoritesDisplay();

    async function searchMusic() {
        const query = searchInput.value.trim();
        const playlistsBottom = document.getElementById('playlists-bottom');
        if (!query) {
            if (playlistsBottom) playlistsBottom.style.display = '';
            resultsDiv.innerHTML = '';
            return;
        }
        if (playlistsBottom) playlistsBottom.style.display = 'none';
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


            songItem.innerHTML = `
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-actions">
                    <button class="play-button" data-id="${song.id}" data-title="${song.title}" data-artist="${song.artist}" data-thumbnail="${song.thumbnail}">Play Song</button>
                    <button class="add-to-playlist-btn" data-id="${song.id}" data-title="${song.title}" data-artist="${song.artist}" data-thumbnail="${song.thumbnail}">＋</button>
                </div>
            `;

            songItem.querySelector('.play-button').addEventListener('click', (e) => {
                e.stopPropagation();
                const button = e.target;
                playSong(button.dataset.id, button.dataset.title, button.dataset.artist, button.dataset.thumbnail);
            });

            songItem.querySelector('.add-to-playlist-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                showPlaylistSelector(e.target.dataset);
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

    // Remove favorites display logic
    function updateFavoritesDisplay() {
        const existingFavorites = document.getElementById('favorites-section');
        if (existingFavorites) {
            existingFavorites.remove();
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
        if (event.data === YT.PlayerState.ENDED) {
            if (isRepeating) {
                player.playVideo();
            } else if (playlistQueue.length > 0) {
                playlistQueueIndex++;
                if (playlistQueueIndex < playlistQueue.length) {
                    const nextSong = playlistQueue[playlistQueueIndex];
                    playSong(nextSong.id, nextSong.title, nextSong.artist, nextSong.thumbnail);
                } else {
                    playlistQueue = [];
                    playlistQueueIndex = 0;
                    playlistMode = null;
                }
            } else if (currentSearchResults && currentSearchResults.length > 1) {
                let idx = currentSearchResults.findIndex(s => s.id === currentVideoId);
                if (idx !== -1 && idx < currentSearchResults.length - 1) {
                    const next = currentSearchResults[idx + 1];
                    playSong(next.id, next.title, next.artist, next.thumbnail);
                }
            }
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
        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');

        console.log('Elements found:', { playPauseBtn, repeatBtn, progressBar, nextBtn, prevBtn });

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
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                playNextSong();
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                playPrevSong();
            });
        }
    }, 1000);
    function playNextSong() {
        if (playlistQueue.length > 0) {
            if (playlistQueueIndex < playlistQueue.length - 1) {
                playlistQueueIndex++;
                const nextSong = playlistQueue[playlistQueueIndex];
                playSong(nextSong.id, nextSong.title, nextSong.artist, nextSong.thumbnail);
            }
        } else if (currentSearchResults && currentSearchResults.length > 0) {
            let idx = currentSearchResults.findIndex(s => s.id === currentVideoId);
            if (idx !== -1 && idx < currentSearchResults.length - 1) {
                const next = currentSearchResults[idx + 1];
                playSong(next.id, next.title, next.artist, next.thumbnail);
            }
        }
    }

    function playPrevSong() {
        if (playlistQueue.length > 0) {
            if (playlistQueueIndex > 0) {
                playlistQueueIndex--;
                const prevSong = playlistQueue[playlistQueueIndex];
                playSong(prevSong.id, prevSong.title, prevSong.artist, prevSong.thumbnail);
            }
        } else if (currentSearchResults && currentSearchResults.length > 0) {
            let idx = currentSearchResults.findIndex(s => s.id === currentVideoId);
            if (idx > 0) {
                const prev = currentSearchResults[idx - 1];
                playSong(prev.id, prev.title, prev.artist, prev.thumbnail);
            }
        }
    }

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

    function renderPlaylists() {
        const playlistsListDiv = document.getElementById('playlists-list');
        playlistsListDiv.innerHTML = '';
        playlists.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'playlist-item' + (selectedPlaylistId === pl.id ? ' selected' : '');
            const nameDiv = document.createElement('div');
            nameDiv.textContent = pl.name;
            nameDiv.style.flex = '1';
            item.appendChild(nameDiv);
            // Controls for play and shuffle
            const controls = document.createElement('div');
            controls.className = 'playlist-controls';
            const playBtn = document.createElement('button');
            playBtn.className = 'playlist-play-btn';
            playBtn.textContent = '▶';
            playBtn.title = 'Play Playlist';
            playBtn.onclick = (e) => {
                e.stopPropagation();
                selectedPlaylistId = pl.id;
                playlistMode = 'play';
                playPlaylist(pl.id, false);
                renderPlaylists();
            };
            const shuffleBtn = document.createElement('button');
            shuffleBtn.className = 'playlist-shuffle-btn';
            shuffleBtn.title = 'Remix (Shuffle)';
            shuffleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
            shuffleBtn.onclick = (e) => {
                e.stopPropagation();
                selectedPlaylistId = pl.id;
                playlistMode = playlistMode === 'shuffle' ? 'play' : 'shuffle';
                playPlaylist(pl.id, playlistMode === 'shuffle');
                renderPlaylists();
            };
            controls.appendChild(playBtn);
            controls.appendChild(shuffleBtn);
            item.appendChild(controls);
            // Expand playlist on click
            item.onclick = (e) => {
                if (e.target === playBtn || e.target === shuffleBtn) return;
                selectedPlaylistId = pl.id;
                renderPlaylists();
            };
            playlistsListDiv.appendChild(item);
            // Show songs if selected
            if (selectedPlaylistId === pl.id) {
                const songs = playlistSongs[pl.id] || [];
                if (songs.length > 0) {
                    const songList = document.createElement('div');
                    songList.className = 'playlist-song-list';
                    songs.forEach(song => {
                        const songDiv = document.createElement('div');
                        songDiv.className = 'playlist-song-item';
                        songDiv.innerHTML = `<span>${song.title} <span style="color:#888;font-size:13px;">${song.artist}</span></span>`;
                        const playSongBtn = document.createElement('button');
                        playSongBtn.className = 'play-button';
                        playSongBtn.textContent = 'Play';
                        playSongBtn.onclick = (ev) => {
                            ev.stopPropagation();
                            playSong(song.id, song.title, song.artist, song.thumbnail);
                        };
                        songDiv.appendChild(playSongBtn);
                        songList.appendChild(songDiv);
                    });
                    playlistsListDiv.appendChild(songList);
                } else {
                    const emptyMsg = document.createElement('div');
                    emptyMsg.className = 'playlist-song-list';
                    emptyMsg.textContent = 'No songs in this playlist.';
                    playlistsListDiv.appendChild(emptyMsg);
                }
            }
        });
    }

    function playPlaylist(playlistId, shuffle) {
        const songs = playlistSongs[playlistId] || [];
        if (songs.length === 0) {
            alert('No songs in this playlist!');
            return;
        }
        if (shuffle) {
            // If already shuffled, keep order
            if (!playlistQueue.length || selectedPlaylistId !== playlistId || playlistMode !== 'shuffle') {
                playlistQueue = [...songs].sort(() => Math.random() - 0.5);
                playlistQueueIndex = 0;
            }
        } else {
            playlistQueue = [...songs];
            playlistQueueIndex = 0;
        }
        const song = playlistQueue[playlistQueueIndex];
        playSong(song.id, song.title, song.artist, song.thumbnail);
    }

    function showPlaylistSelector(songData) {
        if (playlists.length === 0) {
            alert('No playlists available. Create one first!');
            return;
        }
        let html = '<div id="playlist-select-modal" style="position:fixed;top:30%;left:50%;transform:translate(-50%,-30%);background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 10px #0002;z-index:2000;">';
        html += '<h3>Select Playlists</h3>';
        playlists.forEach(pl => {
            html += `<label style="display:block;margin-bottom:6px;"><input type="checkbox" value="${pl.id}" ${playlistSongs[pl.id]?.some(s => s.id === songData.id) ? 'checked' : ''}> ${pl.name}</label>`;
        });
        html += '<button id="save-to-playlists-btn">Save</button> <button id="cancel-playlist-select-btn">Cancel</button>';
        html += '</div>';
        const modal = document.createElement('div');
        modal.innerHTML = html;
        document.body.appendChild(modal);

        modal.querySelector('#save-to-playlists-btn').onclick = () => {
            const checked = Array.from(modal.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
            playlists.forEach(pl => {
                if (checked.includes(pl.id)) {
                    if (!playlistSongs[pl.id]) playlistSongs[pl.id] = [];
                    if (!playlistSongs[pl.id].some(s => s.id === songData.id)) {
                        playlistSongs[pl.id].push(songData);
                    }
                } else {
                    if (playlistSongs[pl.id]) {
                        playlistSongs[pl.id] = playlistSongs[pl.id].filter(s => s.id !== songData.id);
                    }
                }
            });
            localStorage.setItem('musicPlaylistSongs', JSON.stringify(playlistSongs));
            document.body.removeChild(modal);
            renderPlaylists();
        };
        modal.querySelector('#cancel-playlist-select-btn').onclick = () => {
            document.body.removeChild(modal);
        };
    }

    if (document.getElementById('add-playlist-btn')) {
        document.getElementById('add-playlist-btn').addEventListener('click', () => {
            const name = prompt('Enter playlist name:');
            if (name && name.trim()) {
                const id = 'pl_' + Date.now();
                playlists.push({ id, name });
                playlistSongs[id] = [];
                localStorage.setItem('musicPlaylists', JSON.stringify(playlists));
                localStorage.setItem('musicPlaylistSongs', JSON.stringify(playlistSongs));
                renderPlaylists();
            }
        });
    }
    renderPlaylists();
});
