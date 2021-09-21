"use strict";

const Discord = require("discord.js");
const config = require("./config.json");
const Fs = require('fs');
const users= JSON.parse(Fs.readFileSync('./users.json'));
const weapons= require('./weapons.json');
const { count } = require("console");

const birdMessage= "```·-.,¸_¸,.-°`'°·-.,¸¸,.-·°'`' \\_°· Hou-hou!```";
const client = new Discord.Client();
let idChanel= '806826327968579624';

client.login(config.BOT_TOKEN);

console.log(users);
let bird= false;
let birdStartTime= 0;
let lastKiller;


/* Events ------------ */

client.on("message", function(message) { 
    //filtres
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;
   

    setUserIfNotExist(message.author);
    //logs
    console.log(curDate()+' '+message.author.username+": "+message.content);

    //get commande and arguments
    const commandBody = message.content.slice(config.prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();
    
    //actions (commandes)
    if(command == 'stats'){
        stats(message);
    }
    else if(command == 'top'){
        top();
    }
    else if(command == 'don'){
        if(args.length == 2){
            don(message, args.shift().substring(3, 21), args.shift());
        }
        else{
            message.reply(`Erreur de syntaxe.`);
        }
    }
    else if(command == 'help'){
        help();
    }
    else if (message.author.id in users && users[message.author.id].banTime > new Date().getTime()){ //test tmp ban
        message.reply(`ton arme est confisquée, va jouer ailleurs.`);
        return;
    }

    else if(command == 'pan'){
        shot(message);
    }

    else if(command == 'recharge'){
        reload(message);
    }

});  

client.on("ready", function(){
    console.log(curDate()+` Bot started! Logged in as ${client.user.tag}!`);
    launchNewBird();
});


/* Functions ------------ */

/* cmd shot */
function shot(message){
    const idUser= message.author.id;
    if(!isLoaded(idUser)){
        message.reply(`*clic* , ton fusil n'est pas chargé.`);
        return;
    }
    users[idUser]['loaded']--;

    /*part, attaque an user*/
    if(message.mentions.users.size){
        let target= [... message.mentions.users.values()][0]; // ugly way to get the first element of a discord map
        
        if(target.id in users){
            if(target.id == idUser){
                message.reply(users[idUser].name + ' se sucide (-10pts).');
                changeScore(idUser, -10);
            }else{
                let msg= '';
                const date= new Date();
                const day= date.getDay();

                //date test
                if(day == 5){
                    msg= 'reste zen, demain c\'est le weekend';
                }else if(day == 6){
                    msg= 'c\'est le weekend, on ne tire pas dans le dos des camarades';
                }else if(day == 0){ //sunday
                    msg= 'https://www.youtube.com/watch?v=VOgFZfRVaww';
                }
                
                else if(!calcSuccess(idUser)){
                    msg= 'cible manqué.'
                }else{
                    const rand= Math.random()*10;
                    users[idUser].banTime= new Date().getTime() + 1000*60*60*24;
                    msg= `L'arme de ${users[idUser].name} est confisqué pour 24h, il a touché ${users[target.id].name} `;

                    if(rand > 9){
                        msg+= "à la tête (-15pts)";
                        changeScore(target.id, -15);
                    } else if(rand > 5){
                        msg+= "au torse (-7pts)";
                        changeScore(target.id, -7);
                    } else{
                        msg+= "au genoux (-2pts)";
                        changeScore(target.id, -2);
                    }
                }
                message.reply(msg);
            }
        }
        else{
            message.reply("Tu t'es tiré une balle dans le pied par maladresse (-5pts).");
            changeScore(idUser, -5);
        }
        users[idUser]['loaded']--;
    }

    /*part bird*/
    else{
        if(bird){
            if(!calcSuccess(idUser)){
                message.reply(`**BANG** mince, raté !`);
            }
            else touched(message);
        }
        else if(Date.now() < birdStartTime+1000*60*5 && lastKiller != idUser){
            message.reply(`Trop tard =(`);
        } 
        else{
            message.reply(`Où tu tires ?`);
        }
    }
}

function touched(message) {
    const idUser= message.author.id;
    const timeTaken = Date.now() - birdStartTime;
    bird = false;
    
    incrementBird(idUser);

    const scoreEvolution= getScoreEvolution(timeTaken, idUser);
    const oldScore= users[idUser]['score'];
    const newScore= oldScore + scoreEvolution;
    usersOverwelmed(idUser, newScore, oldScore)
    .then(overwhelmed=>{
        let msg= `***BANG*** , tu as eu l'hibou en ${timeTaken / 1000}s. (+${scoreEvolution}pts)`;
        if(overwhelmed.length){
            let txt= 'Tu passe devant ';
            for (let i = 0; i < overwhelmed.length; i++) {
                txt+= `<@!${overwhelmed[i]}>`;
                if(i != overwhelmed.length-1) txt+= ', ';
                else  txt+= '. ';
            }
            msg+= '\n'+txt;
        }
        
        message.reply(msg);

        users[idUser]['score']+= scoreEvolution;
        saveUsers();
    });
    
    launchNewBird();
}

//return the list of the players who curUser overWelmed now
async function usersOverwelmed(curUser, newScore, oldScore){
    const usersOverwelmed= [];
    for (const idUser in users) {    
        if(
            idUser != curUser && 
            users[idUser]['score'] < newScore && 
            users[idUser]['score'] >= oldScore
        ){
            //let nameUser= await client.users.fetch(idUser)
            //usersOverwelmed.push(nameUser['username']);

            usersOverwelmed.push(idUser);
        }
    }
    return usersOverwelmed;
}

//save score in objet users
function getScoreEvolution(timeTaken, idUser){
    //score
    timeTaken/= 1000;
    let scoreEvolution= 0;
    if(timeTaken < 10) scoreEvolution= 3;
    else if(timeTaken < 30) scoreEvolution= 2;
    else scoreEvolution= 1;

    lastKiller= idUser;

    return scoreEvolution;
}

// increment the bird shot in the current objet users
function incrementBird(idUser){
    users[idUser]['birds']++;

    return users[idUser]['birds'];
}

function calcSuccess(idUser){
    const threshold= weapons[users[idUser]['weapon']]['occurrency'];
    const rand= Math.floor(Math.random() * 100 + 1);

    return rand <= threshold;
}


/* cmd reload */

function reload(message){
    if(!isLoaded(message.author.id)){
        users[message.author.id]['loaded']= weapons[users[message.author.id]['weapon']]['loaderCapacity'];
        message.reply(`ton arme est maintenant chargée.`);
        saveUsers();
    }
    else message.reply(`ton arme est déjà chargée.`);
}

//if the amunition is the weapon max
function isLoaded(idUser){
    if(users[idUser]['loaded'] == weapons[users[idUser]['weapon']]['loaderCapacity']){
        return true;
    }
    return false;
}


/* cmd stats */

function stats(message){
    
    if(message.mentions.users.size && message.mentions.users.size < 10){

        message.mentions.users.map( user=>{
            if(user.id in users){
                const ptsUser= users[user.id]['score'];
                message.reply(user.username+` a `+ptsUser+' pts.');
            }
            else message.reply(user.username+` n'est pas enregisté`);
        });
    }
    else{
        const idUser= message.author.id;
        if( idUser in users){
            const ptsUser= users[idUser]['score'];
            message.reply(` tu as `+ptsUser+' pts.');
        }
    }
}

/* cmd top */
function top(){
    let[top, topScore]= getBestUser();
    let msg= '\n🥇 ';
    msg+= nameListToString(top);
    msg+= 'avec '+topScore+' pts';
    let excusion= top;

    [top, topScore]= getBestUser(excusion);
    msg+= '\n🥈 ';
    msg+= nameListToString(top);
    msg+= 'avec '+topScore+' pts';
    excusion= excusion.concat(top);

    [top, topScore]= getBestUser(excusion);
    msg+= '\n🥉 ';
    msg+= nameListToString(top);
    msg+= 'avec '+topScore+' pts';

    const channel= client.channels.cache.get(idChanel);
    channel.send(msg);
}

function nameListToString(list){
    let txt= '';
    for (const idUser of list) {
        txt+= `<@!${idUser}>`+' ';
    }
    return txt
}

function getBestUser(excusion= []){
    let top = [];
    let topScore= null;
    for (const idUser in users){
        if(excusion.includes(idUser)){
            continue;
        }
        else if(top === null){
            top = [idUser];
            topScore = users[idUser].score;
        }
        else if(users[idUser].score > topScore){
            top = [idUser];
            topScore = users[idUser].score;
        }
        else if(users[idUser].score == topScore){
            top.push(idUser);
        }
    }
    return [top, topScore];
}

/* cmd don */

function don(message, idFriend, quantity){
    const idUser= message.author.id;
    quantity= parseInt(quantity);
    console.log(idFriend);
    if(!(idFriend in users)){
        message.reply(`Cet utilisateur n'est pas enregisté.`);
        return false;
    }else if(users[idUser]['score'] < quantity){
        message.reply(`Tu n'as pas la moula.`);
        return false;
    }
    else if(quantity > 0){
        users[idUser]['score']-= quantity;
        users[idFriend]['score']+= quantity;
        saveUsers();
        message.reply(users[idFriend].name+` a maintenant `+ users[idFriend].score + ' pts');
        return true;
    }
    return false;
}
    

/* others functions */

function setUserIfNotExist(author){
    const idUser= author.id;
    if(!(idUser in users)){
        users[idUser]= {
            'birds': 0,
            'score': 0,
            'loaded': 1,
            'weapon': 1,
            'banTime': 0,
            'name': author.username
        };
        saveUsers()
    }
}

//set a new bird after a coldown
function launchNewBird(){
    const date= new Date();
    const day= date.getDay();
    const hour= date.getHours();
    const newTime= Math.floor(Math.random()*10000*5*60)+100000;
    console.log(curDate()+' Next bird in '+((newTime/60)/1000)+' minutes.');
    setTimeout(()=>{
        //day off , night off
        if(day == 6 || day == 0 || hour > 21 || hour < 9){
            setTimeout(()=>{ launchNewBird, 10000*60*60*2 });
            return;
        }
        
        //set bird
        bird= true;
        birdStartTime= new Date().getTime();
        const channel= client.channels.cache.get(idChanel);
        channel.send(birdMessage);
    } , newTime);
}

//rewrite users.json file
function saveUsers(){
    let data= JSON.stringify(users);
    Fs.writeFile('users.json', data, (e)=>{if(e){console.log(curDate()+' '+e)}});
}

//get the current date
function curDate(){
    return new Date().toLocaleString();
}

function changeScore(idUser, modification){
    users[idUser]['score']+= modification;
    saveUsers();
}

//display all the options
function help(){
    const options=[
        ['pan', 'tire sur le hibou'],
        ['recharge', 'recharge ton fusil'],
        ['stats', 'affiche les statistiques de la personne mentionné', 'stats @mention'],
        ['don', 'offrir tes points', 'don @mention quantité'],
        ['top', 'affiche les points des meilleurs joueurs', 'top']
    ];
    let msg= '';
    for (const option of options) {
        msg+= '**'+option[0]+'** : '+ option[1];
        if(option.length == 3){
            msg+= '  |  *'+config.prefix+option[2]+'*';
        }
        else{
            msg+= '  |  *'+config.prefix+option[0]+'*';
        }
        msg+= '\n';
    }
    const channel= client.channels.cache.get(idChanel);
    channel.send(msg);
}

