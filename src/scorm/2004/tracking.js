const SCORMCommunicator = require( './communicator.js' );
import ids from '../../../public/_jsons/ids.json';

function initialize() {

    try {
        const scormCommunicator = new SCORMCommunicator();

        const storedSuccessStatus = scormCommunicator.get('cmi.success_status');
        const scoreRaw = scormCommunicator.get('cmi.score.raw');
        const scoreScaled = scormCommunicator.get('cmi.score.scaled');

        if (storedSuccessStatus !== 'passed') {
            scormCommunicator.set('cmi.score.min', 0);
            scormCommunicator.set('cmi.score.max', 100);
            scormCommunicator.set('cmi.completion_status', 'incomplete');
            if (isNaN(parseInt(scoreRaw))) {
                scormCommunicator.set('cmi.score.raw', 0);
            }
            if (isNaN(parseFloat(scoreScaled))) {
                scormCommunicator.set('cmi.score.scaled', 0);
            }
            scormCommunicator.save();
        }

        return true;

    } catch (exception) {
        console.log(exception);
    }


}

function trackTerminate() {
	try {
		const scormCommunicator = new SCORMCommunicator();

		scormCommunicator.quit();
	} catch (exception) {
		console.log(exception);
	}
}

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
            scormCommunicator.set('cmi.success_status', 'passed');
            scormCommunicator.set('cmi.score.raw', 100);
        }

        scormCommunicator.set('cmi.completion_status', 'completed');

    } else {
        scormCommunicator.set('cmi.completion_status', 'incomplete');
        scormCommunicator.set('cmi.success_status', 'failed');
    }

    scormCommunicator.save();

});

document.addEventListener('track-quiz-attempt', event => {

    const scormCommunicator = new SCORMCommunicator();
    const score = event.detail.score * 100;

    const scoreIsBetterThanBefore = score > scormCommunicator.get('cmi.score.raw');

    if (scoreIsBetterThanBefore) {
        scormCommunicator.set('cmi.score.raw', score);
    }

    if (event.detail.success) {

        const completedPlaylists = getPlaylistArray(scormCommunicator.get('cmi.suspend_data'));
        completedPlaylists.push(event.detail.id + '');
        scormCommunicator.set('cmi.suspend_data', completedPlaylists.join(','));
        scormCommunicator.set('cmi.success_status', 'passed');
		scormCommunicator.set('cmi.completion_status', 'completed');

    }

    scormCommunicator.save();

});

document.addEventListener('track-terminate', () => {
	trackTerminate();
});

window.addEventListener('beforeunload', () => {
	trackTerminate();
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
