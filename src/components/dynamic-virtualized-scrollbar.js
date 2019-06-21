import React, {Component} from 'react';
import {Scrollbars} from 'react-custom-scrollbars';
import PropTypes from 'prop-types';
// import {SpringSystem} from 'rebound';
import Rebound from 'rebound';
import {throws} from 'assert';

class DynamicVirtualizedScrollbar extends Component {
	constructor(props) {
		super(props);

		const initialElemsToRender = this.props.initialElemsToRender != null ? this.props.initialElemsToRender : 8;

		this.state = {
			// Update this when dynamic row height becomes a thing
			scrollOffset: 0,
			firstRenderedItemIndex: 0,
			lastRenderedItemIndex: initialElemsToRender,
			averageItemSize: this.props.minElemHeight,
			aboveSpacerHeight: 0,
			// Initially guess that all elems are min height
			belowSpacerHeight: (props.listLength - initialElemsToRender) * props.minElemHeight,
			firstElemBounds: {},
			lastElemBounds: {}
		};
		this.childRefs = [];
		this.stickyElems = null;
		this.lastElemBounds = null;
		this.firstElemBounds = null;
		this.MAX_RENDERS = 200;
		this.seenIdxs = [];
		this.lastScrollBreakpoint = 0;
		this.updateSpacing = this.updateSpacing.bind(this);
	}

	componentDidMount() {
		this.springSystem = new Rebound.SpringSystem();
		this.spring = this.springSystem.createSpring();
		this.spring.setOvershootClampingEnabled(true);
		this.spring.addListener({onSpringUpdate: this.handleSpringUpdate.bind(this)});
		if (this.inner) {
			this.setState({containerTop: this.inner.getBoundingClientRect().top});
		}
		// Set initial bounds for first and last rendered elems
		if (this.itemsContainer) {
			const lastElemBounds = this.itemsContainer.lastElementChild.getBoundingClientRect();
			const firstElemBounds = this.itemsContainer.firstElementChild.getBoundingClientRect();
			this.firstElemBounds = {
				top: firstElemBounds.top,
				bottom: firstElemBounds.bottom,
				left: firstElemBounds.left,
				right: firstElemBounds.right
			};
			this.lastElemBounds = {
				top: lastElemBounds.top,
				bottom: lastElemBounds.bottom,
				left: lastElemBounds.left,
				right: lastElemBounds.right
			};
		}
	}

	componentDidUpdate(prevProps, prevState) {
		// If we're rendering new things, update how much space we think is left in the rest of the list below, according to the new average
		if (prevState.lastRenderedItemIndex !== this.state.lastRenderedItemIndex || prevState.averageItemSize !== this.state.averageItemSize) {
			requestAnimationFrame(this.updateSpacing);
		}
	}

	componentWillUnmount() {
		this.springSystem.deregisterSpring(this.spring);
		this.springSystem.removeAllListeners();
		this.springSystem = undefined;
		this.spring.destroy();
		this.spring = undefined;
	}

	shouldComponentUpdate(nextProps, nextState) {
		// only render when visible items change -> smooth scroll
		return (
			nextState.aboveSpacerHeight !== this.state.aboveSpacerHeight ||
			nextState.belowSpacerHeight !== this.state.belowSpacerHeight ||
			nextState.firstElemBounds !== this.state.firstElemBounds ||
			nextState.lastElemBounds !== this.state.lastElemBounds ||
			nextState.firstRenderedItemIndex !== this.state.firstRenderedItemIndex ||
			nextState.lastRenderedItemIndex !== this.state.lastRenderedItemIndex ||
			nextProps !== this.props
		);
	}

	updateSpacing() {
		this.setState({belowSpacerHeight: (this.props.listLength - this.state.firstRenderedItemIndex + 1) * this.state.averageItemSize});
	}

	handleSpringUpdate(spring) {
		const val = spring.getCurrentValue();
		this.scrollBars.scrollTop(val);
	}

	getListToRender(list) {
		// let listToRender = [];
		this.stickyElems = [];
		const lastRenderedItemIndex = this.state.lastRenderedItemIndex;
		const firstRenderedItemIndex = this.state.firstRenderedItemIndex;

		// render only visible items
		let items = list.slice(firstRenderedItemIndex, lastRenderedItemIndex + 1);

		list.forEach((child, index) => {
			// Maintain elements that have the alwaysRender flag set. This is used to keep a dragged element rendered, even if its scroll parent would normally unmount it.
			if (this.props.stickyElems.find(id => id === child.props.draggableId)) {
				this.stickyElems.push(child);
			}
		});

		if (this.stickyElems && this.stickyElems.length > 0) {
			items = items.filter(elem => !this.stickyElems.find(e => e.props.draggableId === elem.props.draggableId));
		}
		return items;
	}

	setElementBounds(scrollOffset) {
		const firstElemBounds = this.itemsContainer.firstElementChild.getBoundingClientRect();
		const lastElemBounds = this.itemsContainer.lastElementChild.getBoundingClientRect();
		this.firstElemBounds = {
			top: firstElemBounds.top,
			bottom: firstElemBounds.bottom,
			left: firstElemBounds.left,
			right: firstElemBounds.right
		};
		this.lastElemBounds = {
			top: lastElemBounds.top,
			bottom: lastElemBounds.bottom,
			left: lastElemBounds.left,
			right: lastElemBounds.right
		};
		// Update scroll breakpoint when finding new elements
		this.lastScrollBreakpoint = scrollOffset;
	}

	// Save scroll position in state for virtualization
	handleScroll(e) {
		const scrollOffset = this.scrollBars ? this.scrollBars.getScrollTop() : 0;
		let scrollingDown = true;

		if (this.scrollOffset === scrollOffset) {
			// No change
			return;
		}

		// Remove all spacing at end of list
		if (this.state.lastRenderedItemIndex === this.props.listLength - 1 && this.state.belowSpacerHeight !== 0) {
			this.setState({
				belowSpacerHeight: 0
			});
			return;
		}
		// Remove all top spacing at beginning of list
		else if (this.state.firstRenderedItemIndex === 0 && this.state.aboveSpacerHeight !== 0) {
			this.setState({aboveSpacerHeight: 0});
			return;
		}

		if (this.itemsContainer && this.itemsContainer.lastElementChild && this.itemsContainer.firstElementChild) {
			// Check if we're increasing or decreasing scroll
			if (this.scrollOffset) {
				if (scrollOffset < this.scrollOffset) {
					scrollingDown = false;
				}
			}
			this.scrollOffset = scrollOffset;
			const viewPortTop = this.state.containerTop;
			const viewPortBottom = this.state.containerTop + this.props.containerHeight;
			if (this.firstElemBounds == null || this.lastElemBounds == null) {
				this.setElementBounds(scrollOffset);
			} else {
				const scrollChange = scrollOffset - this.lastScrollBreakpoint;
				this.firstElemBounds.top -= scrollChange;
				this.firstElemBounds.bottom -= scrollChange;
				this.lastElemBounds.top -= scrollChange;
				this.lastElemBounds.bottom -= scrollChange;
			}

			// SCROLLING DOWN BEGINS
			if (scrollingDown) {
				// If viewPortTop has scrolled past first bottom, move first elem one down the list
				if (this.firstElemBounds && this.firstElemBounds.bottom <= viewPortTop) {
					const elemSize = Math.abs(this.firstElemBounds.bottom - this.firstElemBounds.top);
					this.setState(
						prevState => {
							return {
								firstRenderedItemIndex: Math.min(prevState.firstRenderedItemIndex + 1, this.props.listLength - 1),
								aboveSpacerHeight: prevState.aboveSpacerHeight + elemSize
							};
						},
						() => this.setElementBounds(scrollOffset)
					);
				}
				// If viewport bottom has crossed last elem bottom, render one more elem below
				if (this.lastElemBounds && this.lastElemBounds.bottom <= viewPortBottom) {
					const elemSize = Math.abs(this.lastElemBounds.bottom - this.lastElemBounds.top);
					const stateUpdate = {
						lastRenderedItemIndex: Math.min(this.state.lastRenderedItemIndex + 1, this.props.listLength - 1)
						//belowSpacerHeight: Math.max(this.state.belowSpacerHeight - elemSize, 0)
					};
					// If we're still below the end of the list
					if (this.state.lastRenderedItemIndex < this.props.listLength) {
						// Only do it the first time we see the new elem
						if (!this.seenIdxs.includes(this.state.lastRenderedItemIndex)) {
							// How much bigger is this elem than the min height?
							const elemSizeDiffFromMin = elemSize - this.props.minElemHeight;
							// Update the rolling average item size, used for calculating remaining below space (under the list of rendered items)
							stateUpdate.averageItemSize = (this.state.averageItemSize + elemSizeDiffFromMin) / 2;
							this.seenIdxs.push(this.state.lastRenderedItemIndex);
						}
					}
					this.setState(stateUpdate, () => this.setElementBounds(scrollOffset));
				}
				// SCROLLING DOWN ENDS
			} else {
				// SCROLLING UP BEGINS
				// If viewport is scrolled up above first elements top
				if (this.firstElemBounds && viewPortTop <= this.firstElemBounds.top) {
					const elemSize = Math.abs(this.firstElemBounds.bottom - this.firstElemBounds.top);
					this.setState(
						prevState => {
							return {firstRenderedItemIndex: Math.max(prevState.firstRenderedItemIndex - 1, 0), aboveSpacerHeight: Math.max(prevState.aboveSpacerHeight - elemSize, 0)};
						},
						() => this.setElementBounds(scrollOffset)
					);
				}

				// If viewport has scrolled up over last top
				if (this.lastElemBounds && viewPortBottom <= this.lastElemBounds.top) {
					const elemSize = Math.abs(this.lastElemBounds.bottom - this.lastElemBounds.top);
					this.setState(
						prevState => {
							return {
								lastRenderedItemIndex: Math.max(prevState.lastRenderedItemIndex - 1, 0)
								// belowSpacerHeight: prevState.belowSpacerHeight + elemSize
							};
						},
						() => this.setElementBounds(scrollOffset)
					);
				}
				// SCROLLING UP ENDS
			}
		}
	}

	// Animated scroll to top
	animateScrollTop(top) {
		const scrollTop = this.scrollBars.getScrollTop();
		this.spring.setCurrentValue(scrollTop).setAtRest();
		this.spring.setEndValue(top);
	}

	// Get height of virtualized scroll container
	getScrollHeight() {
		return this.scrollBars.getScrollHeight();
	}
	// Set scroll offset of virtualized scroll container
	scrollTop(val) {
		this.scrollBars.scrollTop(val);
	}
	// Get scroll offset of virtualized scroll container
	getScrollTop() {
		return this.scrollBars.getScrollTop();
	}

	render() {
		const {children} = this.props;

		let childrenWithProps = React.Children.map(children, (child, index) => React.cloneElement(child, {originalindex: index, ref: node => (this.childRefs[index] = node)}));
		const listToRender = this.getListToRender(childrenWithProps);

		const belowSpacerStyle = {border: this.props.showIndicators ? 'solid 3px yellow' : 'none', width: '100%', height: this.state.belowSpacerHeight};
		const aboveSpacerStyle = {border: this.props.showIndicators ? 'solid 3px purple' : 'none', width: '100%', height: this.state.aboveSpacerHeight};

		if (this.stickyElems && this.stickyElems.length > 0) {
			listToRender.push(this.stickyElems[0]);
		}

		const innerStyle = {
			width: '100%',
			display: 'flex',
			flexDirection: 'column',
			flexGrow: '1',
			minHeight: this.props.containerHeight
		};

		const listItemsStyle = {
			width: '100%',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			flexGrow: '1'
		};

		let firstIndicatorStyle;
		let lastIndicatorStyle;
		if (this.firstElemBounds && this.lastElemBounds) {
			firstIndicatorStyle = {
				top: this.firstElemBounds.top,
				left: this.firstElemBounds.left,
				width: this.firstElemBounds.right - this.firstElemBounds.left - 6,
				height: this.firstElemBounds.bottom - this.firstElemBounds.top - 6,
				boxSizing: 'border-box',
				background: 'transparent',
				border: 'solid 3px green',
				position: 'fixed'
			};
			lastIndicatorStyle = {
				top: this.lastElemBounds.top,
				left: this.lastElemBounds.left,
				width: this.lastElemBounds.right - this.lastElemBounds.left - 6,
				height: this.lastElemBounds.bottom - this.lastElemBounds.top - 6,
				boxSizing: 'border-box',
				background: 'transparent',
				border: 'solid 3px blue',
				position: 'fixed'
			};
		}
		return (
			<Scrollbars
				onScroll={this.handleScroll.bind(this)}
				ref={div => (this.scrollBars = div)}
				autoHeight={true}
				autoHeightMax={this.props.containerHeight}
				autoHeightMin={this.props.containerHeight}
			>
				{this.props.showIndicators ? <div className={'first-indicator'} style={firstIndicatorStyle} /> : null}
				{this.props.showIndicators ? <div className={'last-indicator'} style={lastIndicatorStyle} /> : null}

				<div className={'virtualized-scrollbar-inner'} style={innerStyle} ref={div => (this.inner = div)}>
					<div style={aboveSpacerStyle} className={'above-spacer'} />
					<div className={'list-items'} style={listItemsStyle} ref={div => (this.itemsContainer = div)}>
						{listToRender}
					</div>
					<div style={belowSpacerStyle} className={'below-spacer'} />
				</div>
			</Scrollbars>
		);
	}
}
DynamicVirtualizedScrollbar.propTypes = {
	minElemHeight: PropTypes.number.isRequired
};
export default DynamicVirtualizedScrollbar;