import { parse } from 'node-html-parser';
import * as fs from "fs";
import * as prompt from 'prompt';
prompt.start();

const getPercentage = (value: number, outOf: number): number => {
  return Math.round((value / outOf) * 100);
}

const simulateValidationOfCompetencies: string[] = [];

//************************************
//            DATA MODELS 
//************************************

class CompetencyLayer1 {
  name: string;
  subCategories: CompetencyLayer2[];
}

class CompetencyLayer2 {
  name: string;
  validated: boolean;
  competencies: Competency[];
}

class Competency {
  name: string;
  validated: boolean;
  skills: Skill[];
}

class Skill {
  name: string;
  constructor(name){
    this.name = name;
  }
}

class SkillStats extends Skill {
  name: string;
  validatedCompetencies: Competency[];
  nonValidatedCompetencies: Competency[];

  constructor(name: string, validatedCompetencies: Competency[], nonValidatedCompetencies: Competency[]){
    super(name);
    this.validatedCompetencies = validatedCompetencies;
    this.nonValidatedCompetencies = nonValidatedCompetencies;
  }

  percentageValidated = (): number => {
    return getPercentage(this.validatedCompetencies.length, this.validatedCompetencies.length + this.nonValidatedCompetencies.length);
  }
}




//************************************
//      READING AND PARSING HTML 
//************************************

fs.readFile('./competency_tree.html', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }

  let layer1Count: number = 0;
  let layer2Count: number = 0;
  let layer2ValidatedCount: number = 0;
  let competenciesCount: number = 0;
  let competenciesValidatedCount: number = 0;
  let layer1Competencies: CompetencyLayer1[] = [];
  const root = parse(data);
  const layer1Nodes = root.querySelectorAll('.competencyTree > ul.tree > .branch > .tree');

  for(let layer1Node of layer1Nodes){
    let layer1Name = layer1Node.querySelector('.branch > .competencyLine > .competencyTitle').textContent.trim();

    let layer2Competencies: CompetencyLayer2[] = [];
    let layer2Nodes = layer1Node.querySelectorAll('> li > ul.tree');

    for(let layer2Node of layer2Nodes){
      let layer2Name = layer2Node.querySelector('.branch > .competencyLine > .competencyTitle').textContent.trim();
      let layer2Validated = !!layer2Node.classList.contains('proficient');

      let competencies: Competency[] = [];
      let competencyNodes = layer2Node.querySelectorAll('> li > ul.tree-end');

      for(var competencyNode of competencyNodes){
        let competencyName = competencyNode.querySelector('.branch-end > .competencyLine > .competencyTitle').textContent.trim();
        let competencyValidated = !!competencyNode.classList.contains('proficient');

        if(simulateValidationOfCompetencies.some(c => c === competencyName))
          competencyValidated = true;

        let skills: Skill[] = competencyNode.querySelector('div.description p')?.innerHTML.split('<br>').map(s => {return {name: s.trim().replace('-', ' - ')}}).filter(s => s.name.length > 0) || [];

        competencies.push({
          name: competencyName,
          validated: competencyValidated,
          skills
        });
        competenciesCount += 1;
        if(competencyValidated)
          competenciesValidatedCount += 1;
      }

      layer2Competencies.push({
        name: layer2Name,
        validated: layer2Validated,
        competencies
      });
      layer2Count += 1;
      if(layer2Validated)
        layer2ValidatedCount += 1;
    }

    layer1Competencies.push({
      name: layer1Name,
      subCategories: layer2Competencies
    });
    layer1Count += 1;
  }


  //************************************
  //            SKILL STATS 
  //************************************

  let skillStats: SkillStats[] = [];
  layer1Competencies.forEach(l1 => {
    l1.subCategories.forEach(l2 => {
      l2.competencies.forEach(c => {
        c.skills.forEach(s => {
          let index = skillStats.findIndex(stat => stat.name === s.name);
          if(index > -1){
            if(c.validated){
              skillStats[index].validatedCompetencies.push(c);
            }
            else {
              skillStats[index].nonValidatedCompetencies.push(c);
            }
          }
          else {
            if(c.validated){
              skillStats.push(new SkillStats(s.name, [c], []));
            }
            else {
              skillStats.push(new SkillStats(s.name, [], [c]));
            }
          }
        });
      });
    });
  });


  //************************************
  //        DISPLAY FUNCTIONS
  //************************************

  const displayCompetencies = (displaySkills: boolean, hideValidated: boolean) => {
    let count = 0;
    layer1Competencies.forEach(l1 => {
      console.log(`[${!l1.subCategories.some(l2 => !l2.validated) ? 'X' : ' '}] ${l1.name}`);
      l1.subCategories.forEach(l2 => {
        if(hideValidated && !l2.competencies.some(c => !c.validated))
          return;
        console.log(`├── [${l2.validated ? 'X' : ' '}] ${l2.name}`);
        l2.competencies.forEach(c => {
          if(hideValidated && c.validated)
            return;
          count += 1;
          console.log(`│    ├── [${c.validated ? 'X' : ' '}] ${c.name}`);
          if(displaySkills){
            c.skills.forEach(s => {
              console.log(`│    │    ├── ${s.name}`);
            });
            console.log('│    │');
          }
        });
        console.log('│');
      });
      console.log('');
    });
    console.log(`Displayed ${count} competencies`);
  };

  const displaySkills = (orderByMostMissing: boolean, displayCompetencies: boolean) => {
    if(orderByMostMissing){
      skillStats.sort((a,b) => a.percentageValidated()-b.percentageValidated());
    }
    else {
      skillStats.sort((a,b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0);
    }

    const pad = (num: number, size: number): string => {
      let str = num.toString();
      while(str.length < size) str = " " + str;
      return str;
    }

    let referencedCompetencies = []

    skillStats.forEach(s => {
      if(orderByMostMissing){
        console.log(`(${pad(s.percentageValidated(), 3)}%) ${s.name}`);
        if(displayCompetencies){
          s.nonValidatedCompetencies.forEach(c => {
            console.log(`            [ ] ${c.name}`)
            let index = referencedCompetencies.findIndex(d => d.name === c.name)
            if(index == -1)
              referencedCompetencies.push({name: c.name, count: 1});
            else
              referencedCompetencies[index].count = referencedCompetencies[index].count + 1;
          });
        }
      }
      else {
        console.log(`${s.name} (${s.percentageValidated()}%)`);
        if(displayCompetencies){
          s.nonValidatedCompetencies.forEach(c => {
            console.log(`        [ ] ${c.name}`)
          });
          s.validatedCompetencies.forEach(c => {
            console.log(`        [X] ${c.name}`)
          });
        }
      }
      displayCompetencies && console.log('');
    });

    if(orderByMostMissing && displayCompetencies) {
      console.log("")
      console.log("")
      console.log("Most referenced competencies:")
      referencedCompetencies.sort((a,b) => b.count-a.count).forEach(c => {
        console.log(`    - ${c.name} (${c.count} times)`);
      });
      console.log("")
      console.log("")
    }
  }


  //************************************
  //                MENU
  //************************************


  const menu = () => {
    console.log('');
    console.log('');
    console.log('In total, we found in the html document:');
    console.log(`    - ${layer1Count} entries for layer 1`);
    console.log(`    - ${layer2Count} entries for layer 2 (you validated ${layer2ValidatedCount} of them - ${getPercentage(layer2ValidatedCount, layer2Count)}%)`);
    console.log(`    - ${competenciesCount} entries for competencies (you validated ${competenciesValidatedCount} of them - ${getPercentage(competenciesValidatedCount, competenciesCount)}%)`);
    console.log(`    - ${skillStats.length} different skills`);
    console.log('');
    console.log('');
    console.log('File parsed, what are you looking for?');
    console.log('    [1] All competencies');
    console.log('    [2] All competencies and the skills attributed to them');
    console.log('    [3] All competencies not validated');
    console.log('    [4] All competencies not validated and the skills attributed to them');
    console.log('    [5] All skills');
    console.log('    [6] All skills sorted by those you are missing the most');
    console.log('    [7] All skills and the competencies attributed to them');
    console.log('    [8] All skills sorted by those you are missing the most and the competencies attributed to them that you are missing');
    console.log('    [9] Exit');

    prompt.get([{name: 'choice', validator: /^(?:[1-9])$/, warning: 'You can only chose between 1 and 9'} as prompt.RevalidatorSchema], (err, result) => {
      if(err){
        console.error(err)
        return;
      }

      console.log('');
      console.log('');
      console.log('#######################################################');
      console.log('');
      console.log('');

      switch(result.choice){
        case '1': 
          displayCompetencies(false, false);
          break;
        case '2':
          displayCompetencies(true, false);
          break;
        case '3':
          displayCompetencies(false, true);
          break;
        case '4':
          displayCompetencies(true, true);
          break;
        case '5':
          displaySkills(false, false);
          break;
        case '6':
          displaySkills(true, false);
          break;
        case '7':
          displaySkills(false, true);
          break;
        case '8':
          displaySkills(true, true);
          break;
        case '9':
        default:
          return;
      }
      menu();
    })
  };

  menu();
});