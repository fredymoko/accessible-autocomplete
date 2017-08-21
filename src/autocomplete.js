import { createElement, Component } from 'preact' /** @jsx createElement */
import Status from './status'
import DropdownArrowDown from './dropdown-arrow-down'

const IS_PREACT = process.env.COMPONENT_LIBRARY === 'PREACT'
const IS_REACT = process.env.COMPONENT_LIBRARY === 'REACT'

const keyCodes = {
  13: 'enter',
  27: 'escape',
  32: 'space',
  38: 'up',
  40: 'down'
}

// Based on https://github.com/ausi/Feature-detection-technique-for-pointer-events
const hasPointerEvents = (() => {
  const element = document.createElement('x')
  element.style.cssText = 'pointer-events:auto'
  return element.style.pointerEvents === 'auto'
})()

function isIosDevice () {
  return !!(navigator.userAgent.match(/(iPod|iPhone|iPad)/g) && navigator.userAgent.match(/AppleWebKit/g))
}

function isPrintableKeyCode (keyCode) {
  return (
    (keyCode > 47 && keyCode < 58) ||   // number keys
    keyCode === 32 || keyCode === 8 ||  // spacebar or backspace
    (keyCode > 64 && keyCode < 91) ||   // letter keys
    (keyCode > 95 && keyCode < 112) ||  // numpad keys
    (keyCode > 185 && keyCode < 193) || // ;=,-./` (in order)
    (keyCode > 218 && keyCode < 223)    // [\]' (in order)
  )
}

// Preact does not implement onChange on inputs, but React does.
function onChangeCrossLibrary (handler) {
  if (IS_PREACT) { return { onInput: handler } }
  if (IS_REACT) { return { onChange: handler } }
}

export default class Autocomplete extends Component {
  static defaultProps = {
    autoselect: false,
    cssNamespace: 'autocomplete',
    defaultValue: '',
    displayMenu: 'inline',
    minLength: 0,
    name: 'input-autocomplete',
    placeholder: '',
    onConfirm: () => {},
    confirmOnBlur: true,
    //showNoOptionsFound: true,
    showAllValues: false,
    required: false,
    tNoResults: () => 'No results found',
    dropdownArrow: DropdownArrowDown
  }

  elementReferences = {}

  constructor (props) {
    super(props)

    this.state = {
      focused: null,
      hovered: null,
      menuOpen: false,
      options: props.defaultValue ? [props.defaultValue] : [],
      query: props.defaultValue,
      selected: null,
      showNoOptionsFound: false
    }

    this.handleComponentBlur = this.handleComponentBlur.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleUpArrow = this.handleUpArrow.bind(this)
    this.handleDownArrow = this.handleDownArrow.bind(this)
    this.handleEnter = this.handleEnter.bind(this)
    this.handlePrintableKey = this.handlePrintableKey.bind(this)

    this.handleOptionBlur = this.handleOptionBlur.bind(this)
    this.handleOptionClick = this.handleOptionClick.bind(this)
    this.handleOptionFocus = this.handleOptionFocus.bind(this)
    this.handleOptionMouseDown = this.handleOptionMouseDown.bind(this)
    this.handleOptionMouseEnter = this.handleOptionMouseEnter.bind(this)
    this.handleOptionMouseOut = this.handleOptionMouseOut.bind(this)
    this.handleOptionTouchEnd = this.handleOptionTouchEnd.bind(this)

    this.handleInputBlur = this.handleInputBlur.bind(this)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.handleInputFocus = this.handleInputFocus.bind(this)

    this.pollInputElement = this.pollInputElement.bind(this)
    this.getDirectInputChanges = this.getDirectInputChanges.bind(this)
  }

  componentDidMount () {
    this.pollInputElement()
  }

  componentWillUnmount () {
    clearTimeout(this.$pollInput)
  }

  // Applications like Dragon NaturallySpeaking will modify the
  // `input` field by directly changing its `.value`. These events
  // don't trigger our JavaScript event listeners, so we need to poll
  // to handle when and if they occur.
  pollInputElement () {
    this.getDirectInputChanges()
    this.$pollInput = setTimeout(() => {
      this.pollInputElement()
    }, 100)
  }

  getDirectInputChanges () {
    const inputReference = this.elementReferences[-1]
    const queryHasChanged = inputReference.value !== this.state.query
    if (queryHasChanged) {
      this.handleInputChange({ target: { value: inputReference.value } })
    }
  }

  componentDidUpdate (prevProps, prevState) {
    const { focused } = this.state
    const componentLostFocus = focused === null
    const focusedChanged = prevState.focused !== focused
    const focusDifferentElement = focusedChanged && !componentLostFocus
    if (focusDifferentElement) {
      this.elementReferences[focused].focus()
    }
    const focusedInput = focused === -1
    const componentGainedFocus = focusedChanged && prevState.focused === null
    const selectAllText = focusedInput && componentGainedFocus
    if (selectAllText) {
      const inputElement = this.elementReferences[focused]
      inputElement.setSelectionRange(0, inputElement.value.length)
    }
  }

  hasAutoselect () {
    return isIosDevice() ? false : this.props.autoselect
  }

  // This template is used when converting from a state.options object into a state.query.
  templateInputValue (value) {
    const inputValueTemplate = this.props.templates && this.props.templates.inputValue
    return inputValueTemplate ? inputValueTemplate(value) : value
  }

  // This template is used when displaying results / suggestions.
  templateSuggestion (value) {
    const suggestionTemplate = this.props.templates && this.props.templates.suggestion
    return suggestionTemplate ? suggestionTemplate(value) : value
  }

  handleComponentBlur (newState) {
    const { options, query, selected } = this.state
    let newQuery
    if (this.props.confirmOnBlur) {
      newQuery = newState.query || query
      this.props.onConfirm(options[selected])
    } else {
      newQuery = query
    }
    this.setState({
      focused: null,
      menuOpen: newState.menuOpen || false,
      options: [],
      showNoOptionsFound: false,
      query: newQuery,
      selected: null
    })
  }

  handleOptionBlur (event, index) {
    const { focused, menuOpen, options, selected } = this.state
    const focusingOutsideComponent = event.relatedTarget === null
    const focusingInput = event.relatedTarget === this.elementReferences[-1]
    const focusingAnotherOption = focused !== index && focused !== -1
    const blurComponent = focusingOutsideComponent || !(focusingAnotherOption || focusingInput)
    if (blurComponent) {
      const keepMenuOpen = menuOpen && isIosDevice()
      this.handleComponentBlur({
        menuOpen: keepMenuOpen,
        query: this.templateInputValue(options[selected])
      })
    }
  }

  handleInputBlur (event) {
    const { focused, menuOpen, options, query, selected } = this.state
    const focusingAnOption = focused !== -1
    if (!focusingAnOption) {
      const keepMenuOpen = menuOpen && isIosDevice()
      const newQuery = isIosDevice() ? query : this.templateInputValue(options[selected])
      this.handleComponentBlur({
        menuOpen: keepMenuOpen,
        query: newQuery
      })
    }
  }

  handleInputChange (event) {
    const { minLength, source, showAllValues } = this.props
    const autoselect = this.hasAutoselect()
    const query = event.target.value
    const queryEmpty = query.length === 0
    const queryChanged = this.state.query.length !== query.length
    const queryLongEnough = query.length >= minLength

    this.setState({ query })

    const searchForOptions = showAllValues || (!queryEmpty && queryChanged && queryLongEnough)
    if (searchForOptions) {
      console.log('>>>searchForOptions')
      console.log('handleInputChange state', this.state)
      source(query, (options) => {
        const optionsAvailable = options.length > 0
        this.setState({
          menuOpen: optionsAvailable,
          options,
          selected: (autoselect && optionsAvailable) ? 0 : -1,
          showNoOptionsFound: !optionsAvailable && true
        })
      })
    } else if (queryEmpty || !queryLongEnough) {
      this.setState({
        menuOpen: false,
        options: []
      })
    }
  }

  handleInputClick (event) {
    this.handleInputChange(event)
  }

  handleInputFocus (event) {
    this.setState({
      focused: -1
    })
  }

  handleOptionFocus (index) {
    this.setState({
      focused: index,
      hovered: null,
      selected: index
    })
  }

  handleOptionMouseEnter (event, index) {
    this.setState({
      hovered: index
    })
  }

  handleOptionMouseOut (event, index) {
    this.setState({
      hovered: null
    })
  }

  handleOptionTouchEnd (event, index) {
    this.handleOptionClick(event, index)
  }

  handleOptionClick (event, index) {
    event.preventDefault()
    const selectedOption = this.state.options[index]
    const newQuery = this.templateInputValue(selectedOption)
    this.props.onConfirm(selectedOption)
    this.setState({
      focused: -1,
      menuOpen: false,
      options: [],
      query: newQuery,
      showNoOptionsFound: false,
      selected: -1
    })
    console.log('handleOptionClick this state', this.state)
  }

  handleOptionMouseDown (event) {
    // Safari triggers focusOut before click, but if you
    // preventDefault on mouseDown, you can stop that from happening.
    // If this is removed, clicking on an option in Safari will trigger
    // `handleOptionBlur`, which closes the menu, and the click will
    // trigger on the element underneath instead.
    // See: http://stackoverflow.com/questions/7621711/how-to-prevent-blur-running-when-clicking-a-link-in-jquery
    event.preventDefault()
  }

  handleUpArrow (event) {
    event.preventDefault()
    const { menuOpen, selected } = this.state
    const isNotAtTop = selected !== -1
    const allowMoveUp = isNotAtTop && menuOpen
    if (allowMoveUp) {
      this.handleOptionFocus(selected - 1)
    }
  }

  handleDownArrow (event) {
    event.preventDefault()
    // if not open, open
    if (this.props.showAllValues && this.state.menuOpen === false) {
      event.preventDefault()
      this.props.source('', (options) => {
        this.setState({
          menuOpen: true,
          options,
          selected: 0,
          focused: 0,
          hovered: null
        })
      })
    } else if (this.state.menuOpen === true) {
      const { menuOpen, options, selected } = this.state
      const isNotAtBottom = selected !== options.length - 1
      const allowMoveDown = isNotAtBottom && menuOpen
      if (allowMoveDown) {
        this.handleOptionFocus(selected + 1)
      }
    }
  }

  handleSpace (event) {
    // if not open, open
    if (this.props.showAllValues && this.state.menuOpen === false) {
      event.preventDefault()
      this.props.source('', (options) => {
        this.setState({
          menuOpen: true,
          options
        })
      })
    }
    const focusIsOnOption = this.state.focused !== -1
    if (focusIsOnOption) {
      event.preventDefault()
      this.handleOptionClick(event, this.state.focused)
    }
  }

  handleEnter (event) {
    if (this.state.menuOpen) {
      event.preventDefault()
      const hasSelectedOption = this.state.selected >= 0
      if (hasSelectedOption) {
        this.handleOptionClick(event, this.state.selected)
      }
    }
  }

  handlePrintableKey (event) {
    const inputElement = this.elementReferences[-1]
    const eventIsOnInput = event.target === inputElement
    if (!eventIsOnInput) {
      // FIXME: This would be better if it was in componentDidUpdate,
      // but using setState to trigger that seems to not work correctly
      // in preact@8.1.0.
      inputElement.focus()
    }
  }

  handleKeyDown (event) {
    switch (keyCodes[event.keyCode]) {
      case 'up':
        this.handleUpArrow(event)
        break
      case 'down':
        this.handleDownArrow(event)
        break
      case 'space':
        this.handleSpace(event)
        break
      case 'enter':
        this.handleEnter(event)
        break
      case 'escape':
        this.handleComponentBlur({
          query: this.state.query
        })
        break
      default:
        if (isPrintableKeyCode(event.keyCode)) {
          this.handlePrintableKey(event)
        }
        break
    }
  }

  render () {
    const {
      cssNamespace,
      displayMenu,
      id,
      minLength,
      name,
      placeholder,
      required,
      showAllValues,
      tNoResults,
      tStatusQueryTooShort,
      tStatusNoResults,
      tStatusSelectedOption,
      tStatusResults,
      dropdownArrow: dropdownArrowFactory
    } = this.props
    const { focused, hovered, menuOpen, options, query, selected, showNoOptionsFound } = this.state
    const autoselect = this.hasAutoselect()

    const wrapperClassName = `${cssNamespace}__wrapper`

    const inputClassName = `${cssNamespace}__input`
    const componentIsFocused = focused !== null
    const inputModifierFocused = componentIsFocused ? ` ${inputClassName}--focused` : ''
    const inputModifierType = this.props.showAllValues ? ` ${inputClassName}--show-all-values` : ` ${inputClassName}--default`
    const dropdownArrowClassName = `${cssNamespace}__dropdown-arrow-down`
    const optionFocused = focused !== -1 && focused !== null

    const menuClassName = `${cssNamespace}__menu`
    const menuModifierDisplayMenu = `${menuClassName}--${displayMenu}`
    const menuIsVisible = menuOpen || showNoOptionsFound
    const menuModifierVisibility = `${menuClassName}--${(menuIsVisible) ? 'visible' : 'hidden'}`

    const optionClassName = `${cssNamespace}__option`

    const hintClassName = `${cssNamespace}__hint`
    const selectedOptionText = this.templateInputValue(options[selected])
    const optionBeginsWithQuery = selectedOptionText &&
      selectedOptionText.toLowerCase().indexOf(query.toLowerCase()) === 0
    const hintValue = (optionBeginsWithQuery && autoselect)
      ? query + selectedOptionText.substr(query.length)
      : ''
    const showHint = hasPointerEvents && hintValue

    let dropdownArrow

    // we only need a dropdown arrow if showAllValues is set to a truthy value
    if (showAllValues) {
      dropdownArrow = dropdownArrowFactory({ className: dropdownArrowClassName })

      // if the factory returns a string we'll render this as HTML (usage w/o (P)React)
      if (typeof dropdownArrow === 'string') {
        dropdownArrow = <div className={`${cssNamespace}__dropdown-arrow-down-wrapper`} dangerouslySetInnerHTML={{ __html: dropdownArrow }} />
      }
    }

    console.log('menuIsVisible', menuIsVisible)

    return (
      <div className={wrapperClassName} onKeyDown={this.handleKeyDown}>
        <Status
          length={options.length}
          queryLength={query.length}
          menuIsVisible={menuIsVisible}
          minQueryLength={minLength}
          selectedOption={this.templateInputValue(options[selected])}
          tQueryTooShort={tStatusQueryTooShort}
          tNoResults={tStatusNoResults}
          tSelectedOption={tStatusSelectedOption}
          tResults={tStatusResults}
        />

        {showHint && (
          <span><input className={hintClassName} readonly tabIndex='-1' value={hintValue} /></span>
        )}

        <li>Results length {options.length}</li>

        <input
          aria-activedescendant={optionFocused ? `${id}__option--${focused}` : false}
          aria-expanded={menuOpen}
          aria-owns={`${id}__listbox`}
          autoComplete='off'
          className={`${inputClassName}${inputModifierFocused}${inputModifierType}`}
          id={id}
          onClick={(event) => this.handleInputClick(event)}
          onBlur={this.handleInputBlur}
          {...onChangeCrossLibrary(this.handleInputChange)}
          onFocus={this.handleInputFocus}
          name={name}
          placeholder={placeholder}
          ref={(inputElement) => { this.elementReferences[-1] = inputElement }}
          role='combobox'
          type='text'
          required={required}
          value={query}
        />

        {dropdownArrow}

        <ul
          className={`${menuClassName} ${menuModifierDisplayMenu} ${menuModifierVisibility}`}
          id={`${id}__listbox`}
          role='listbox'
        >
          {options.map((option, index) => {
            const showFocused = focused === -1 ? selected === index : focused === index
            const optionModifierFocused = showFocused && hovered === null ? ` ${optionClassName}--focused` : ''
            const optionModifierOdd = (index % 2) ? ` ${optionClassName}--odd` : ''

            return (
              <li
                aria-selected={focused === index}
                className={`${optionClassName}${optionModifierFocused}${optionModifierOdd}`}
                dangerouslySetInnerHTML={{ __html: this.templateSuggestion(option) }}
                id={`${id}__option--${index}`}
                key={index}
                onFocusOut={(event) => this.handleOptionBlur(event, index)}
                onClick={(event) => this.handleOptionClick(event, index)}
                onMouseDown={this.handleOptionMouseDown}
                onMouseEnter={(event) => this.handleOptionMouseEnter(event, index)}
                onMouseOut={(event) => this.handleOptionMouseOut(event, index)}
                onTouchEnd={(event) => this.handleOptionTouchEnd(event, index)}
                ref={(optionEl) => { this.elementReferences[index] = optionEl }}
                role='option'
                tabIndex='-1'
              />
            )
          })}

          {showNoOptionsFound && (
            <li className={`${optionClassName} ${optionClassName}--no-results`}>{tNoResults()}</li>
          )}
        </ul>
      </div>
    )
  }
}
