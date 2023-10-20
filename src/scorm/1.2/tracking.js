const SCORMCommunicator = require( '@this/cobra-framework-export-plugin/src/scorm/1.2/communicator' );
import ids from '@/assets/export/ids.json';

export default (ctx, inject) => {

    try {
        const scormCommunicator = new SCORMCommunicator();

        const storedSuccessStatus = scormCommunicator.get('cmi.core.lesson_status');
        const scoreRaw = scormCommunicator.get('cmi.core.score.raw');

        let suspendData = getSuspendDataObject(scormCommunicator.get('cmi.suspend_data'));
        sessionStorage.setItem('completed', suspendData.cpl);

        if (storedSuccessStatus !== 'passed' && storedSuccessStatus !== 'completed') {

            scormCommunicator.set('cmi.core.score.min', 0);
            scormCommunicator.set('cmi.core.score.max', 100);
            scormCommunicator.set('cmi.core.lesson_status', 'incomplete');
            if (isNaN(parseInt(scoreRaw))) {
                scormCommunicator.set('cmi.core.score.raw', 0);
            }
            scormCommunicator.save();
        }

    } catch (exception) {
        console.log(exception);
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

    document.addEventListener('quiz-attempt', event => {

        const scormCommunicator = new SCORMCommunicator();
        const score = event.detail.score * 100;

        const scoreIsBetterThanBefore = score > scormCommunicator.get('cmi.core.score.raw');

        if (scoreIsBetterThanBefore) {
            scormCommunicator.set('cmi.core.score.raw', score);
        }

        scormCommunicator.save();

    });

    document.addEventListener('quiz-completed', event => {

        const scormCommunicator = new SCORMCommunicator();

        let suspendData = getSuspendDataObject(scormCommunicator.get('cmi.suspend_data'));
        const completedPlaylists = getPlaylistArray(suspendData.cpl);
        completedPlaylists.push(event.detail.id + '');
        scormCommunicator.set('cmi.suspend_data', completedPlaylists.join(','));
        scormCommunicator.set('cmi.core.lesson_status', 'passed');

        scormCommunicator.save();

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

};

