
const questionData = {
  "title": "Test Quiz",
  "questions": [
    {
      "content": "Who designed the original Diney Quiz? (First name)",
      "solutions": [
        {
          "canonicalName": "Bailey",
          "alternatives": [],
          "hints": []
        }
      ]
    },
    {
      "content": "What are the names of Avery's guinea pigs?",
      "solutions": [
        {
          "canonicalName": "Nash",
          "alternatives": [],
          "hints": []
        },
        {
          "canonicalName": "Edsel",
          "alternatives": [],
          "hints": []
        }
      ]
    },
    {
      "content": "What towns/cities has Bailey lived in?",
      "solutions": [
        {
          "canonicalName": "Elgin",
          "alternatives": [],
          "hints": []
        },
        {
          "canonicalName": "Morris",
          "alternatives": [],
          "hints": []
        },
        {
          "canonicalName": "Schaumburg",
          "alternatives": [],
          "hints": []
        },
        {
          "canonicalName": "Springfield",
          "alternatives": [],
          "hints": []
        }
      ]
    },
    {
      "content": "What towns/cities has Avery lived in?",
      "solutions": [
        {
          "canonicalName": "Elgin",
          "alternatives": [],
          "hints": []
        },
        {
          "canonicalName": "Milwaukee",
          "alternatives": [],
          "hints": []
        },
        {
          "canonicalName": "La Crosse"
        },
        {
          "canonicalName": "Mystic"
        }
      ]
    }
  ]
};


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

function QuizQuestion(json) {
  this.content = json.content;
  this.solutions = json.solutions.map((solution) => { return new QuizSolution(solution) });
  this.universalHints = json.universalHints;

  // bound to the input text field of the question
  this.input = "";

  // list of guesses (strings) input by the user
  this.guesses = [];
}

/// Returns the matching solution for a given guess
QuizQuestion.prototype.findSolution = function(guess) {
  return _.find(this.solutions, (solution) => {
    return solution.matches(guess);
  });
};

QuizQuestion.prototype.commitInput = function() {
  const guess = this.input;

  // The guess must be a string, and it cannot be zero characters
  if (typeof guess !== "string" || guess.length === 0) {
    return;
  }

  // Make sure the current guess doesn't already exist in the array.
  // Pushing repeat items into the guesses array causes a "dupes" error in Angular.
  if (!arrayContains(this.guesses, guess)) {

    // Append the guess to the list of guesses
    this.guesses.push(guess);
  }

  // clear the input.
  this.input = "";
};

QuizQuestion.prototype.didSolveSolution = function(solution) {
  return _.some(this.guesses, (guess) => {
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

QuizQuestion.prototype.numberOfHintsRemaining = function() {

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

  // Evaluate one of the question's guesses
  this.evaluateAnswer = function(question, guess) {
    return question.findSolution(guess) !== undefined;
  };

  this.guessIsValidForSolution = function(guess, solution) {
    return solution.matches(guess);
  };



}]);