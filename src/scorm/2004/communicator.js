const { SCORM } = require( 'pipwerks-scorm-api-wrapper' );

module.exports = class SCORMCommunicator {

    // static instance;

    constructor() {

        if (SCORMCommunicator.instance) {
            return SCORMCommunicator.instance;
        }

        SCORM.version = '2004';

        this.isConnected = (SCORM.API.getHandle() && SCORM.API.getHandle().__SCORM_INITIALIZED === true) ? true : SCORM.init();
        this.courseCompleted = false;
        this.passedCoursed = false;

        if (this.isConnected) {
            SCORM.connection.isActive = true;
            SCORM.API.getHandle().__SCORM_INITIALIZED = true;
        }

        SCORMCommunicator.instance = this;
    }

    set(key, value) {

        if (SCORM.connection.isActive) {

            if (key === 'cmi.completion_status') {
                this.courseCompleted = value === 'completed';
            }

            return SCORM.set(key, value);
        }

        return false;
    }

    get(key) {

        if (SCORM.connection.isActive) {
            return SCORM.get(key);
        }

        return false;
    }

    save() {
        return SCORM.save();
    }

    quit() {

        if (SCORM.connection.isActive) {

            if (this.courseCompleted) {
                SCORM.set('cmi.core.exit', 'normal');
            } else {
                SCORM.set('cmi.core.exit', 'suspend');
            }

            SCORM.save();

            return SCORM.quit();
        }

        return false;
    }
};
