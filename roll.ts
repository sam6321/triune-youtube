import DiceExpression from 'dice-expression-evaluator';
import { oneLine } from 'common-tags';
import Discord from "discord.js";

const pattern = /^(.+?)(?:(>{1,2}|<{1,2})\s*([0-9]+?))?\s*$/;

export async function run(message: Discord.Message, args: string[], fromPattern: boolean) {
    const firstArgIndex = fromPattern ? 1 : 0;
    if(!args[firstArgIndex]) {
        args[firstArgIndex] = 'd20';
    } else {
        const rawNumber = parseInt(args[firstArgIndex]);
        if(!isNaN(rawNumber) && String(rawNumber) === args[firstArgIndex]) args[firstArgIndex] = `d${rawNumber}`;
    }

    try {
        const matches = fromPattern ? args : pattern.exec(args[0]);
        const dice = new DiceExpression(matches[1]);

        // Restrict the maximum dice count
        const totalDice = dice.dice.reduce((prev, die) => prev + (die.diceCount || 1), 0);
        if(totalDice > 1000) return { plain: `${message.author} might hurt themselves by rolling that many dice at once!` };

        // Roll the dice
        const rollResult = dice.roll();

        if(matches[2]) {
            // Deal with target operations
            const target = parseInt(matches[3]);
            let response;

            // Target for total roll
            if(matches[2] === '>' || matches[2] === '<') {
                const success = matches[2] === '>' ? rollResult.roll > target : rollResult.roll < target;
                const diceList = buildDiceList(rollResult, totalDice);
                response = oneLine`
						${message.author} has **${success ? 'succeeded' : 'failed'}**.
						(Rolled ${rollResult.roll}, ${!success ? 'not' : ''} ${matches[2] === '>' ? 'greater' : 'less'} than ${target}${diceList ? `;   ${diceList}` : ''})
					`;

                // Target for individual dice (success counting)
            } else if(matches[2] === '>>' || matches[2] === '<<') {
                if(rollResult.diceRaw.length !== 1) return { plain: `${message.author} tried to count successes with multiple dice expressions.` };
                const successes = rollResult.diceRaw[0].reduce((prev, die) => prev + (matches[2] === '>>' ? die > target : die < target), 0);
                response = oneLine`
						${message.author} has **${successes > 0 ? `succeeded ${successes} time${successes !== 1 ? 's' : ''}` : `failed`}**.
						${rollResult.diceRaw[0].length > 1 && rollResult.diceRaw[0].length <= 100 ? `(${rollResult.diceRaw[0].join(',   ')})` : ''}
					`;

                // Oh dear.
            } else {
                throw new Error('Unknown target operator. This should not ever happen.');
            }

            return { plain: response, editable: false };
        } else {
            const diceList = buildDiceList(rollResult, totalDice);
            return {
                plain: `${message.author} rolled **${rollResult.roll}**.${diceList ? ` (${diceList})` : ''}`,
                editable: false
            };
        }
    } catch(err) {
        return { plain: `${message.author} specified an invalid dice expression: ${err}, ni-` };
    }
}

function buildDiceList(result: { diceRaw: any[]; diceSums: { [x: string]: any; }; }, totalDice: number) {
    let diceList = '';
    if(totalDice <= 100 && (result.diceRaw.length > 1 || (result.diceRaw.length > 0 && result.diceRaw[0].length > 1))) {
        diceList = result.diceRaw.map((res, i) => (res.length > 1 ? `${res.join(' + ')} = ${result.diceSums[i]}` : res[0])).join(',   ');
    }
    return diceList;
}