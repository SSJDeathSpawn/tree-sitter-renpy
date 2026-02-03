/**
 * @file Renpy grammar for tree-sitter
 * @author AtomicString
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "renpy",

  externals: $ => [
    $.indent,
    $.dedent,
    $.newline,
    $.error_sentinel,
  ],

  extras: $ => [
    /[ \t\f]/,
    /#[^\n]*/,
  ],

  supertypes: $ => [
    $._simple_stmt, $.say_stmt,
    $.end_statement
  ],

  word: $ => $.NAME,

  rules: {
    /* ─────────────
     * Source
     * ───────────── */

    source_file: $ => repeat1(alias($.middle_statement, $.statement)),

    /* ─────────────
     * Tokens
     * ───────────── */

    NAME: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    STRING: _ => choice(
      seq('"', /([^"\\\n]|\\.)*/, '"'),
      seq("'", /([^'\\\n]|\\.)*/, "'")
    ),

    LABEL_NAME: $ => seq(optional(seq(optional($.NAME), '.')), $.NAME),

    parenthesized_python: _ => choice(
      /\([^\n]*\)/,
      /\[[^\n]*\]/,
      /\{[^\n]*\}/,
    ),

    // Python until a structural colon
    python_rest: _ =>
      token(prec(-1, /[^:\n]+/)),

    /* ─────────────
     * Common expressions
     * ───────────── */

    simple_expr: $ => choice(
      $.NAME,
      $.STRING,
      $.parenthesized_python
    ),

    /* ─────────────
     * Blocks
     * ───────────── */

    block: $ =>
      seq(
        $.indent,
        $.statements,
        $.dedent
      ),

    /* ─────────────
     * Statements
     * ───────────── */

    statements: $ => seq(
        repeat(alias($.middle_statement, $.statement)),
        alias($.end_statement, $.statement),
    ),

    middle_statement: $ => choice(
      $._terminated_simple_stmt,
      $._complex_stmt
    ),

    end_statement: $ => choice(
      $._simple_stmt,
      $._complex_stmt
    ),

    _complex_stmt: $ => choice(
      $.label_stmt,
      $.if_stmt,
      $.while_stmt,
      $.menu_stmt,
    ),

    _terminated_simple_stmt: $ => seq($._simple_stmt, $.newline),

    _simple_stmt: $ => choice(
      $.say_stmt,
      $.show_stmt,
      $.hide_stmt,
      $.scene_stmt,
      $.with_stmt,
      $.jump_stmt,
      $.call_stmt,
      $.return_stmt,
      $.pass_stmt,
      $.define_stmt,
      $.default_stmt,
      $.image_stmt,
    ),

    /* ─────────────
     * Label
     * ───────────── */

    label_stmt: $ =>
      seq(
        "label",
        $.LABEL_NAME,
        ":",
        $.block
      ),

    /* ─────────────
     * Say
     * ───────────── */

    say_stmt: $ => choice( $.say_dialogue, $.say_narration ), 

    say_dialogue: $ => seq( $.say_who, optional($.say_attrs), optional($.say_temp_attrs), $.say_what),
    say_narration: $ => seq( $.say_what),
    say_who: $ => prec(2, $.NAME), 
    say_attr: $ => seq(optional('-'), $.NAME), 
    say_attrs: $ => prec(1, repeat1($.say_attr)), 
    say_temp_attrs: $ => seq("@", $.say_attrs), 
    say_what: $ => $.STRING,

    /* ─────────────
     * Show / Hide / Scene
     * ───────────── */

    show_stmt: $ =>
      seq(
        "show",
        $.image_spec,
        optional($.with_clause),
      ),

    hide_stmt: $ =>
      seq(
        "hide",
        $.image_spec,
        optional($.with_clause),
      ),

    scene_stmt: $ =>
      seq(
        "scene",
        optional($.image_spec),
        optional($.with_clause),
      ),

    image_spec: $ =>
      seq(
        repeat1($.NAME),
        repeat($.image_modifier)
      ),

    image_modifier: $ => choice(
      $.at_clause,
      $.onlayer_clause,
      $.as_clause,
      $.zorder_clause,
      $.behind_clause,
    ),

    behind_clause: $ => seq("behind", repeat1($.NAME)),

    zorder_clause: $ => seq("zorder", $.simple_expr),

    as_clause: $ => seq("as", $.NAME),

    onlayer_clause: $ => seq("onlayer", $.NAME),

    at_clause: $ => seq("at", $.simple_expr),

    /* ─────────────
     * With
     * ───────────── */

    with_clause: $ =>
      seq(
        "with",
        $.simple_expr
      ),

    with_stmt: $ =>
      seq(
        "with",
        $.simple_expr,
      ),

    /* ─────────────
     * Control Flow
     * ───────────── */

    if_stmt: $ =>
      seq(
        "if",
        $.python_rest,
        ":",
        $.block,
        repeat($.elif_clause),
        optional($.else_clause)
      ),

    elif_clause: $ =>
      seq(
        "elif",
        $.python_rest,
        ":",
        $.block
      ),

    else_clause: $ =>
      seq(
        "else",
        ":",
        $.block
      ),

    while_stmt: $ =>
      seq(
        "while",
        $.python_rest,
        ":",
        $.block
      ),

    pass_stmt: $ => "pass",

    /* ─────────────
     * Menu
     * ───────────── */

    menu_stmt: $ =>
      seq(
        "menu",
        optional($.LABEL_NAME),
        ":",
        $.menu_block
      ),

    menu_block: $ =>
      seq(
        $.indent,
        optional(seq($.say_stmt, $.newline)),
        repeat1($.choice),
        $.dedent
      ),

    choice: $ =>
      seq(
        $.say_what,
        ":",
        $.block
      ),

    /* ─────────────
     * Jump / Call / Return
     * ───────────── */

    jump_stmt: $ =>
      seq(
        "jump",
        $.LABEL_NAME,
      ),

    call_stmt: $ =>
      seq(
        "call",
        $.LABEL_NAME,
        optional(seq("from", $.LABEL_NAME)),
      ),

    return_stmt: $ =>
      seq(
        "return",
        optional($.python_rest),
      ),

    /* ─────────────
     * Definitions
     * ───────────── */

    image_stmt: $ =>
      seq(
        "image",
        repeat1($.NAME),
        "=",
        $.python_rest,
      ),

    define_stmt: $ =>
      seq(
        "define",
        $.NAME,
        "=",
        $.python_rest,
      ),

    default_stmt: $ =>
      seq(
        "default",
        $.NAME,
        "=",
        $.python_rest,
      ),
  }
});
