const SCORMCommunicator = require( '@this/cobra-framework-export-plugin/src/scorm/2004/communicator' );
import ids from '@/assets/export/ids.json';

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

document.addEventListener('playlist-completed', event => {

    const scormCommunicator = new SCORMCommunicator();
    let suspendData = getSuspendDataObject(scormCommunicator.get('cmi.suspend_data'));
    const completedPlaylists = getPlaylistArray(suspendData.cpl);

    if (event.detail.completed && (completedPlaylists.indexOf(event.detail.id + '') < 0)) {

        completedPlaylists.push(event.detail.id + '');

    } else if (!event.detail.completed) {

        const index = completedPlaylists.indexOf(event.detail.id + '');
        if (index > -1) {
            completedPlaylists.splice(index, 1);
        }

    }

    suspendData.cpl = completedPlaylists.join(',');
    scormCommunicator.set('cmi.suspend_data', JSON.stringify(suspendData));

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

document.addEventListener('quiz-attempt', event => {

    const scormCommunicator = new SCORMCommunicator();
    const score = event.detail.score * 100;

    const scoreIsBetterThanBefore = score > scormCommunicator.get('cmi.score.raw');

    if (scoreIsBetterThanBefore) {
        scormCommunicator.set('cmi.score.raw', score);
    }

    scormCommunicator.save();

});
document.addEventListener('quiz-completed', event => {

    const scormCommunicator = new SCORMCommunicator();

    let suspendData = getSuspendDataObject(scormCommunicator.get('cmi.suspend_data'));
    const completedPlaylists = getPlaylistArray(suspendData.cpl);
    completedPlaylists.push(event.detail.id + '');
    scormCommunicator.set('cmi.suspend_data', completedPlaylists.join(','));

    if (Object.keys(ids.quizzes).length <= 1) {
        scormCommunicator.set('cmi.success_status', 'passed');
        scormCommunicator.set('cmi.completion_status', 'completed');
    } else {
        let completedAllQuizzes = true;
        Object.keys(ids.quizzes).forEach(key => {
            if (!completedPlaylists.includes(key)) {
                completedAllQuizzes = false;
            }
        });
        if (completedAllQuizzes) {
            scormCommunicator.set('cmi.success_status', 'passed');
            scormCommunicator.set('cmi.completion_status', 'completed');
        }
    }

    scormCommunicator.save();

});

document.addEventListener('track-terminate', () => {
    trackTerminate();
});

window.addEventListener('beforeunload', () => {
    trackTerminate();
});

function getSuspendDataObject(suspend_data) {
    let suspendData = suspend_data;

    if (suspendData.length <= 0) {
        suspendData = '{"cpl": ""}';
    }
    if (!suspendData.includes('cpl')) {
        suspendData = suspendData.replace('{', '{"cpl": "",')
    }

    return JSON.parse(suspendData);
}

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
