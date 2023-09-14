const SCORMCommunicator = require( './communicator.js' );
import ids from '../../../public/_jsons/ids.json';

window.addEventListener('DOMContentLoaded', () => {

    try {
        const scormCommunicator = new SCORMCommunicator();

        const storedSuccessStatus = scormCommunicator.get('cmi.core.lesson_status');
        const scoreRaw = scormCommunicator.get('cmi.core.score.raw');

        if (storedSuccessStatus !== 'passed' && storedSuccessStatus !== 'completed') {

            scormCommunicator.set('cmi.core.score.min', 0);
            scormCommunicator.set('cmi.core.score.max', 100);
            scormCommunicator.set('cmi.core.lesson_status', 'incomplete');
            if (isNaN(parseInt(scoreRaw))) {
                scormCommunicator.set('cmi.core.score.raw', 0);
            }
            scormCommunicator.save();
        }

        return true;

    } catch (exception) {
        return false;
    }


}, { once: true });

document.addEventListener('track-playlist', event => {

    const scormCommunicator = new SCORMCommunicator();
    const completedPlaylists = getPlaylistArray(scormCommunicator.get('cmi.suspend_data'));

    if (event.detail.completed) {

        completedPlaylists.push(event.detail.playlist + '');

    } else {

        const index = completedPlaylists.indexOf(event.detail.playlist + '');
        if (index > -1) {
            completedPlaylists.splice(index, 1);
        }

    }

    scormCommunicator.set('cmi.suspend_data', completedPlaylists.join(','));

    if (playlistsCompleted(completedPlaylists)) {

        if (Object.keys(ids.quizzes).length === 0 && ids.quizzes.constructor === Object) {
            scormCommunicator.set('cmi.core.lesson_status', 'passed');
            scormCommunicator.set('cmi.core.score.raw', 100);
        } else {
            scormCommunicator.set('cmi.core.lesson_status', 'completed');
        }

    } else {

        scormCommunicator.set('cmi.core.score.raw', Math.round(completedPlaylists.length / Object.keys(ids.playlists).length * 100));
        scormCommunicator.set('cmi.core.lesson_status', 'incomplete');

    }

    scormCommunicator.save();

});

document.addEventListener('track-quiz-attempt', event => {

    const scormCommunicator = new SCORMCommunicator();
    const score = event.detail.score * 100;

    const scoreIsBetterThanBefore = score > scormCommunicator.get('cmi.core.score.raw');

    if (scoreIsBetterThanBefore) {
        scormCommunicator.set('cmi.core.score.raw', score);
    }

    if (event.detail.success) {

        const completedPlaylists = getPlaylistArray(scormCommunicator.get('cmi.suspend_data'));
        completedPlaylists.push(event.detail.id + '');
        scormCommunicator.set('cmi.suspend_data', completedPlaylists.join(','));
        scormCommunicator.set('cmi.core.lesson_status', 'passed');

    }

    scormCommunicator.save();

});

function getPlaylistArray(completedPlaylistsRaw) {
    return (completedPlaylistsRaw ? completedPlaylistsRaw.split(',') : []);
}

function playlistsCompleted(completedPlaylists) {
    let courseComplete = true;
    Object.keys(ids.playlists).forEach(key => {
        if (!completedPlaylists.includes(key)) {
            courseComplete = false;
        }
    });

    return courseComplete;
}
