#include "tree_sitter/parser.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum TokenType { INDENT, DEDENT, NEWLINE, ERROR_SENTINEL };

typedef struct {
  uint16_t indents[256];
  int16_t stack_size;
  uint8_t pending_dedents;
} ScannerState;

void *tree_sitter_renpy_external_scanner_create() {
  ScannerState *state = (ScannerState *)malloc(sizeof(ScannerState));
  state->stack_size = 0;
  state->pending_dedents = 0;
  memset(state->indents, 0, sizeof(state->indents));
  return state;
}

void tree_sitter_renpy_external_scanner_destroy(void *payload) {
  free(payload);
}

unsigned tree_sitter_renpy_external_scanner_serialize(void *payload,
                                                      char *buffer) {
  ScannerState *state = (ScannerState *)payload;
  unsigned size = 0;
  memcpy(&buffer[size], &state->stack_size, sizeof(state->stack_size));
  size += sizeof(state->stack_size);
  size_t len = sizeof(state->indents[0]);
  for (int i = 0; i < state->stack_size; i++) {
    memcpy(&buffer[size], &state->indents[i], len);
    size += len;
  }
  memcpy(&buffer[size], &state->pending_dedents,
         sizeof(state->pending_dedents));
  size += sizeof(state->pending_dedents);
  return size;
}

void tree_sitter_renpy_external_scanner_deserialize(void *payload,
                                                    const char *buffer,
                                                    unsigned length) {
  ScannerState *state = (ScannerState *)payload;
  if (length == 0) {
    state->pending_dedents = 0;
    state->stack_size = 0;
    memset(state->indents, 0, sizeof(state->indents));
    return;
  }
  unsigned size = 0;
  memcpy(&state->stack_size, &buffer[size], sizeof(state->stack_size));
  size += sizeof(state->stack_size);
  size_t len = sizeof(state->indents[0]);
  for (int i = 0; i < state->stack_size; i++) {
    memcpy(&state->indents[i], &buffer[size], len);
    size += len;
  }
  memcpy(&state->pending_dedents, &buffer[size],
         sizeof(state->pending_dedents));
  size += sizeof(state->pending_dedents);
}

bool tree_sitter_renpy_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
  ScannerState *state = (ScannerState *)payload;

  if (valid_symbols[ERROR_SENTINEL])
    return false;

  // 1. Handle queued dedents
  if (state->pending_dedents > 0 && valid_symbols[DEDENT]) {
    state->pending_dedents--;
    lexer->result_symbol = DEDENT;
    return true;
  }

  // Skip horizontal whitespace
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
  }

  // 2. Handle Newlines and Indentation
  if (lexer->lookahead == '\n' || lexer->eof(lexer)) {
    // If we need a newline, mark the end of the token right here (at the \n)
    if (valid_symbols[NEWLINE]) {
      lexer->result_symbol = NEWLINE;
      // We don't return yet; we need to check if an INDENT is also happening
    }

    if (lexer->eof(lexer)) {
      if (state->stack_size > 0 && valid_symbols[DEDENT]) {
        state->stack_size--;
        lexer->result_symbol = DEDENT;
        return true;
      }
      return false;
    }

    // Move past the newline
    lexer->advance(lexer, false);

    // Look ahead to calculate the next indentation level
    uint32_t new_indent = 0;
    while (true) {
      if (lexer->lookahead == ' ') {
        new_indent++;
        lexer->advance(lexer, false);
      } else if (lexer->lookahead == '\t') {
        new_indent += 4;
        lexer->advance(lexer, false);
      } else if (lexer->lookahead == '\n') {
        new_indent = 0;
        lexer->advance(lexer, false);
      } else if (lexer->lookahead == '#') {
        while (lexer->lookahead && lexer->lookahead != '\n')
          lexer->advance(lexer, false);
      } else {
        break;
      }
    }

    uint16_t cur_indent =
        state->stack_size > 0 ? state->indents[state->stack_size - 1] : 0;

    // Check INDENT
    if (new_indent > cur_indent && valid_symbols[INDENT]) {
      state->indents[state->stack_size++] = new_indent;
      lexer->result_symbol = INDENT;
      // IMPORTANT: Here we DO NOT mark_end, because we want the indent
      // to consume the whitespace it found.
      return true;
    }

    // Check DEDENT
    if (new_indent < cur_indent && valid_symbols[DEDENT]) {
      while (state->stack_size > 0 &&
             new_indent < state->indents[state->stack_size - 1]) {
        state->pending_dedents++;
        state->stack_size--;
      }
      if (state->pending_dedents > 0) {
        state->pending_dedents--;
        lexer->result_symbol = DEDENT;
        return true;
      }
    }

    // If it's just a regular newline (no indent change)
    if (valid_symbols[NEWLINE]) {
      // NOTE: We don't want to consume the next line's characters!
      // But we already advanced. Tree-sitter handles this if we didn't
      // mark_end after the newline.
      lexer->result_symbol = NEWLINE;
      return true;
    }
  }

  return false;
}
