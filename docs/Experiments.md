## [User Experiment Structure](https://docs.discord.food/topics/experiments#user-experiment-structure)

This object is represented as an array of the following fields:

| Field                | Type     | Description                                                                                                                         |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| hash                 | integer  | 32-bit unsigned Murmur3 hash of the experiment's name                                                                               |
| revision             | integer  | Current version of the rollout                                                                                                      |
| bucket               | integer  | The requesting user or fingerprint's assigned experiment bucket                                                                     |
| override             | integer  | Whether the user or fingerprint has an override for the experiment (-1 for false, 0 for true)                                       |
| population           | integer  | The internal population group the requesting user or fingerprint is in                                                              |
| hash_result          | integer  | The calculated rollout position to use, prioritized over local calculations                                                         |
| aa_mode[^1]          | integer  | The experiment's A/A testing mode, represented as an integer-casted boolean (0 for false, 1 for true)                               |
| trigger_debugging    | integer  | Whether the experiment's analytics trigger debugging is enabled, represented as an integer-casted boolean (0 for false, 1 for true) |
| holdout_name[^2]     | ?string  | A human-readable experiment name (formatted as year-month_name) that disables the experiment                                        |
| holdout_revision[^2] | ?integer | The revision of the holdout experiment                                                                                              |
| holdout_bucket[^2]   | ?integer | The requesting user or fingerprint's assigned bucket for the holdout experiment                                                     |

[^1]: The bucket for A/A tested experiments should always be None (-1) unless an override is present for the resource.

[^2]:
    Holdout information is only present if the user or fingerprint has an assigned bucket for the holdout experiment. Therefore, if holdout experiment information
    is present and the population bucket is set to None (-1), the experiment has been disabled by the holdout. As user experiments are opaque, no client handling is
    required for this field. Just follow the population field as usual.

## Snippets (Get User Experiments) - Not working

```js
(() => {
    var findByProps;
    if (window.Vencord) {
        findByProps = Vencord.Webpack.findByProps;
    } else {
        // https://discord.com/channels/603970300668805120/1085682686607249478/1085682686607249478
        let _mods = webpackChunkdiscord_app.push([[Symbol()],{},r=>r.c]);
        webpackChunkdiscord_app.pop();

        findByProps = (...props) => {
            for (let m of Object.values(_mods)) {
                try {
                    if (!m.exports || m.exports === window) continue;
                    if (props.every((x) => m.exports?.[x])) return m.exports;

                    for (let ex in m.exports) {
                        if (props.every((x) => m.exports?.[ex]?.[x]) && m.exports[ex][Symbol.toStringTag] !== 'IntlMessagesProxy') return m.exports[ex];
                    }
                } catch {}
            }
        }
    }
    const experimentModule = findByProps('getGuildExperimentBucket');
    const experiments = Object.entries(experimentModule.getRegisteredExperiments())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => {
            const titleA = a.title.toLowerCase();
            const titleB = b.title.toLowerCase();
            return titleA < titleB ? -1 : titleA > titleB ? 1 : 0;
        })
        .filter(exp => exp.type === "user");
    const experimentData = {};
    for (const experiment of experiments) {
    	try {
            const data = experimentModule.getUserExperimentDescriptor(experiment.id);
            if (!data) continue;
        	experimentData[experiment.id] = JSON.parse(JSON.stringify(experimentModule.getUserExperimentDescriptor(experiment.id)));
        	delete experimentData[experiment.id].type
        	delete experimentData[experiment.id].hashResult
        	delete experimentData[experiment.id].assignmentSource
        	delete experimentData[experiment.id].sessionId
        	delete experimentData[experiment.id].loadedFromCache
        	delete experimentData[experiment.id].fingerprint
    	}
        catch (e) {
            console.log(experiment)
        }
    }
    copy(JSON.stringify(experimentData));
})();
```

## [Apex Experiment Object](https://docs.discord.food/topics/experiments#apex-experiments-object)

Similarly to user experiments, this object is represented as an array of the following fields:

| Field       | Type     | Description                                                    |
| ----------- | -------- | -------------------------------------------------------------- |
| hashed_name | integer  | 32-bit unsigned Murmur3 hash of the experiment's name          |
| variant_id  | integer  | The ID of the assigned experiment variant for target ~(bucket) |
| flags       | ?integer | The experiment's flags                                         |
| revision    | integer  | Current version of the rollout                                 |

### Apex Experiment Flags

```ts
const ApexExperimentFlags = {
	/**
	 * Experiment is an override
	 *
	 * Value: 1 << 0
	 */
	IS_OVERRIDE: 1n << 0n,
} as const;
```

## Snippets (Get Apex Experiments)

```js
(() => {
    var findByProps;
    if (window.Vencord) {
        findByProps = Vencord.Webpack.findByProps;
    } else {
        // https://discord.com/channels/603970300668805120/1085682686607249478/1085682686607249478
        let _mods = webpackChunkdiscord_app.push([[Symbol()],{},r=>r.c]);
        webpackChunkdiscord_app.pop();

        findByProps = (...props) => {
            for (let m of Object.values(_mods)) {
                try {
                    if (!m.exports || m.exports === window) continue;
                    if (props.every((x) => m.exports?.[x])) return m.exports;

                    for (let ex in m.exports) {
                        if (props.every((x) => m.exports?.[ex]?.[x]) && m.exports[ex][Symbol.toStringTag] !== 'IntlMessagesProxy') return m.exports[ex];
                    }
                } catch {}
            }
        }
    }
    const apexModule = findByProps("getRegisteredExperiments", "setExperimentAssignments");
    // findByProps('getCurrentUser').getCurrentUser().id;
    const apexData = Object.values(apexModule.getState().evaluatedExperiments.user)[0];
    const array = [];
    for (const obj of Object.values(apexData.assignments)) {
        array.push([obj.hashedName, obj.variantId, obj.isOverride ? 1 << 0 : 0 , obj.revision]);
    }
    copy(JSON.stringify({
        // evaluation_id: apexData.evaluationId,
        evaluation_id: crypto.randomUUID().slice(0, 8),
        assignments: array,
    }));
})();
```
