
function caseInsensitiveCompare(lhs, rhs) {
  return _.toUpper(lhs) === _.toUpper(rhs);
}

function arrayContains(haystack, needle) {
  return _.some(haystack, (item) => { return item === needle });
}


function QuizSolution(json) {
  this.canonicalName = json.canonicalName;
  this.alternatives = json.alternatives;
  this.hints = json.hints;
}

/// Indicates whether the provided guess is valid for this solution
QuizSolution.prototype.matches = function(guess) {
  const allowedResponses = _.union([this.canonicalName], this.alternatives);
  return (_.some(allowedResponses, (allowedResponse) => { return caseInsensitiveCompare(allowedResponse, guess) }));
};


function QuizAction(type) {
  this.type = type;
}

QuizAction.guess = function(guessedString) {
  let action = new QuizAction("guess");
  action.guess = guessedString;
  return action;
};

QuizAction.hint = function(hint) {
  let action = new QuizAction("hint");
  action.hint = hint;
  return action;
};

function QuizQuestion(json) {
  this.content = json.content;
  this.solutions = json.solutions.map((solution) => { return new QuizSolution(solution) });
  this.universalHints = json.universalHints;

  // bound to the input text field of the question
  this.input = "";

  // list of actions (including guesses) from the user.
  this.actions = [];
}

QuizQuestion.prototype.guesses = function() {
  const guessActions = _.filter(this.actions, (action) => { return action.type === "guess"});
  return _.map(guessActions, (action) => { return action.guess });
};

/// Returns the matching solution for a given guess
QuizQuestion.prototype.findSolution = function(guess) {
  return _.find(this.solutions, (solution) => {
    return solution.matches(guess);
  });
};

QuizQuestion.prototype.guessIsCorrect = function(guess) {
  return this.findSolution(guess) !== undefined;
};

QuizQuestion.prototype.commitInput = function() {
  const guess = this.input;

  // The guess must be a string, and it cannot be zero characters
  if (typeof guess !== "string" || guess.length === 0) {
    return;
  }

  // Make sure the current guess doesn't already exist in the array.
  // Pushing repeat items into the guesses array causes a "dupes" error in Angular.
  if (!arrayContains(this.guesses(), guess)) {

    // Append the guess to the list of guesses
    const guessAction = QuizAction.guess(guess);
    this.actions.push(guessAction);
  }

  // clear the input.
  this.input = "";
};

QuizQuestion.prototype.didSolveSolution = function(solution) {
  return _.some(this.guesses(), (guess) => {
    return solution.matches(guess);
  })
};

QuizQuestion.prototype.knownSolutions = function() {
  return _.filter(this.solutions, (solution) => {
    return this.didSolveSolution(solution);
  });
};

QuizQuestion.prototype.unknownSolutions = function() {
  return _.reject(this.solutions, (solution) => {
    return this.didSolveSolution(solution);
  });
};

QuizQuestion.prototype.interpretCanonicalAnswer = function(guess) {
  const matchingSolution = this.findSolution(guess) || {};
  return matchingSolution.canonicalName || guess;
};

QuizQuestion.prototype.hasUnknownSolutions = function() {
  return this.unknownSolutions().length > 0;
};

QuizQuestion.prototype.didSolveAllSolutions = function() {
  return this.unknownSolutions().length === 0;
};

QuizQuestion.prototype.totalNumberOfHints = function() {
  // Get the universal hints
  const universalHints = this.universalHints || [];
  const individualSolutionHints = _.flatMap(this.solutions, (solution) => { return solution.hints || [] });
  return universalHints.length + individualSolutionHints.length;
};

QuizQuestion.prototype.showsUniversalHintsSection = function() {
  return (this.universalHints || []).length > 0
};

QuizQuestion.prototype.totalPenaltyForSolution = function(solution) {

  // Gather up all the actions that were taken before the answer was found.
  const actionsBeforeCorrectAnswer = _.takeWhile(this.actions, (action) => {

    // Keep taking unless this is a guess, and the guess matches the solution
    return !(action.type === 'guess' && solution.matches(action.guess));
  });

  // Assign a penalty value for each action.
  const actionPenalties = _.map(actionsBeforeCorrectAnswer, (action) => {
    if (action.type === 'guess') {

      // Make sure that this guess is wrong for BOTH answers, not just this one.
      // it's possible that this guess was the correct answer for a different solution.
      if (this.guessIsCorrect(action.guess)) {

        // This is a correct answer. No penalty.
        return 0;
      } else {

        // Incorrect answer. -1 point.
        return 1;
      }

    } else if (action.type === 'hint') {

      // Don't penalize the user if this hint was for a different solution.
      const hintAppliesToThisSolution = _.some(solution.hints, (hint) => { return _.isEqual(hint, action.hint) });
      const hintIsUniversal = _.some(this.universalHints, (hint) => { return _.isEqual(hint, action.hint) });
      if (hintAppliesToThisSolution || hintIsUniversal) {

        // This hint was used for this solution.
        return 2;
      } else {

        // This hint did not apply to this solution.
        return 0;
      }

    } else {
      return 0;
    }
  });

  console.log(actionPenalties);

  // Return the sum of all penalties.
  return _.sum(actionPenalties);
};

QuizQuestion.prototype.computePointsEarnedForSolution = function(solution) {

  // Each solution is worth 5 points, -1 for each hint taken.
  const baseValue = 10;

  // If this solution isn't found, award 0 points.
  if (!this.didSolveSolution(solution)) { return 0; }

  const totalPenalty = this.totalPenaltyForSolution(solution);
  return Math.max(baseValue - totalPenalty, 0);
};

QuizQuestion.prototype.computePointsEarnedForGuess = function(guess) {
  const solution = this.findSolution(guess);
  if (solution) {
    return this.computePointsEarnedForSolution(solution);
  } else {
    return 0;
  }
};

QuizQuestion.prototype.computeTotalPointsEarned = function() {

  const scores = this.solutions.map((solution) => {
    return this.computePointsEarnedForSolution(solution);
  });

  // Sum the scores up
  return _.sum(scores);
};

QuizQuestion.prototype.showHint = function(hint) {
  hint.isShown = true;
  const hintAction = QuizAction.hint(hint);
  this.actions.push(hintAction);
};

const app = angular.module('QuizApp', []);

app.controller('QuizController', ['$http', function($http) {

  this.loadQuestionJSON = function(questionJSON) {
    this.questions = questionJSON.questions.map((questionJSON) => {
      return new QuizQuestion(questionJSON);
    });
  };

  $http.get('./js/disney-quiz.json').then((result) => {
    this.loadQuestionJSON(result.data);
  });

  // Take the question's input, and move it to its guesses.
  this.commitQuestionInput = function(question) {
    question.commitInput();
  };

  this.guessIsValidForSolution = function(guess, solution) {
    return solution.matches(guess);
  };



}]);